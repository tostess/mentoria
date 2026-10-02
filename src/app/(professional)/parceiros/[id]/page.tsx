import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import {
  AgendarComParceiro,
  type DiaOferecido,
} from "@/components/profissional/AgendarComParceiro";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { requireRole } from "@/lib/auth/session";
import { deOndeVemAFicha } from "@/lib/profissional/conta";
import { ParceiroIndisponivel, horariosLivres } from "@/lib/bookings";
import { loadAppConfig } from "@/lib/config/load";
import { DURACAO_DA_SESSAO_MIN } from "@/lib/config/limites";
import { ehId } from "@/lib/forms";
import { chaveDoDia, diaDaSemanaLongo, diaEMes, hora, rotuloDoFuso } from "@/lib/formato";
import {
  carregarAgendaDoProfissional,
  carregarCarteira,
  carregarFuso,
  carregarParceiroAtivo,
} from "@/lib/profissional/dados";
import type { Slot } from "@/lib/scheduling";

export const metadata = { title: "Agendar" };

/** Os horários do motor, agrupados por dia no fuso de quem vai agendar. */
function porDia(slots: Slot[], fuso: string): DiaOferecido[] {
  const dias = new Map<string, DiaOferecido>();
  for (const slot of slots) {
    const chave = chaveDoDia(slot.inicio, fuso);
    const dia = dias.get(chave) ?? {
      chave,
      semana: diaDaSemanaLongo(slot.inicio, fuso),
      data: diaEMes(slot.inicio, fuso),
      horarios: [],
    };
    dia.horarios.push({
      inicio: slot.inicio.toISOString(),
      hora: hora(slot.inicio, fuso),
      fim: hora(slot.fim, fuso),
    });
    dias.set(chave, dia);
  }
  return [...dias.values()];
}

/**
 * A página do Parceiro vista pelo Profissional: quem é, e quando pode.
 *
 * O perfil vem pela RLS; os horários, do motor, pela mesma leitura que a reserva
 * refaz antes de escrever. Tudo o que é instante é convertido aqui, no fuso do
 * Profissional — o componente de cliente só recebe texto e o ISO para devolver.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await requireRole("professional");
  const { id } = await params;
  if (!ehId(id)) notFound();

  const config = await loadAppConfig();
  const t = config.terms;

  const parceiro = await carregarParceiroAtivo(id);
  if (parceiro === null) notFound();

  const fuso = await carregarFuso(sessao.userId);
  const carteira = await carregarCarteira(sessao.userId);
  const agenda = await carregarAgendaDoProfissional(sessao.userId, t.partner);
  const pendentes = agenda.filter((s) => s.status === "pending").length;

  let slots: Slot[] = [];
  try {
    slots = await horariosLivres(id, new Date(), config);
  } catch (erro) {
    // Pausado entre a leitura do perfil e esta: a página mostra a grade vazia.
    if (!(erro instanceof ParceiroIndisponivel)) throw erro;
  }

  const primeiroNome = parceiro.nome.split(/\s+/)[0] || parceiro.nome;
  const subtitulo = [parceiro.chamada, parceiro.senioridade].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader
        eyebrow={
          <nav aria-label="Trilha">
            <Link href="/parceiros" className="hover:text-[#C2317A]">
              {t.partners}
            </Link>{" "}
            › {parceiro.nome}
          </nav>
        }
        title={parceiro.nome}
        description={subtitulo || undefined}
        lead={<Avatar name={parceiro.nome} photoUrl={parceiro.foto} size="lg" />}
      />

      <div className="flex flex-col gap-[18px]">
        <AgendarComParceiro
          partnerId={id}
          primeiroNome={primeiroNome}
          dias={porDia(slots, fuso)}
          rotuloDoFuso={rotuloDoFuso(fuso)}
          saldo={carteira?.saldo ?? 0}
          preco={config.fichaPolicy.price30}
          tetoCarteira={config.fichaPolicy.maxBalance}
          pendentes={pendentes}
          maxPendentes={config.limits.maxPendingPerProfessional}
          confirmaSozinho={parceiro.confirmaSozinho}
          horasParaResponder={config.limits.pendingExpiresHours}
          duracaoMin={DURACAO_DA_SESSAO_MIN}
          termos={{ ficha: t.ficha, fichas: t.fichas, sessao: t.session }}
          deOndeVemAFicha={deOndeVemAFicha(sessao.tipoDeConta, t)}
        />

        {(parceiro.bio || parceiro.areas.length > 0 || parceiro.habilidades.length > 0) && (
          <Card title="Sobre" className="lg:max-w-[calc(60%-7px)]">
            {parceiro.bio && <p className="whitespace-pre-line text-[14px]">{parceiro.bio}</p>}
            {(parceiro.areas.length > 0 || parceiro.habilidades.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-[5px]">
                {[...parceiro.areas, ...parceiro.habilidades].map((item) => (
                  <Tag key={item}>{item}</Tag>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
