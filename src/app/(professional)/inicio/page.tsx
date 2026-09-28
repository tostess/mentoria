import Link from "next/link";
import { LinhaDeSessao } from "@/components/agenda/LinhaDeSessao";
import { PageHeader } from "@/components/shell/PageHeader";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FichaStack } from "@/components/ui/Ficha";
import { Icone } from "@/components/ui/Icone";
import { Note } from "@/components/ui/Note";
import { Pill } from "@/components/ui/Pill";
import { requireRole } from "@/lib/auth/session";
import { limiteDeResposta, separarAgenda } from "@/lib/bookings/agenda";
import { loadAppConfig } from "@/lib/config/load";
import { diaDaSemanaCurto, diaDaSemanaLongo, diaDoMes, diaEHora, hora } from "@/lib/formato";
import {
  carregarAgendaDoProfissional,
  carregarCarteira,
  carregarEu,
} from "@/lib/profissional/dados";
import { cap } from "@/lib/terms";

export const metadata = { title: "Início" };

/**
 * O início do Profissional: a próxima conversa, o que espera resposta, e
 * quantas fichas ainda há. Sem sessão marcada, o destaque vira convite para a
 * busca — a subutilização é o problema de produto que decide a renovação.
 */
export default async function Page() {
  const sessao = await requireRole("professional");
  const config = await loadAppConfig();
  const t = config.terms;
  const { nome, fuso } = await carregarEu(sessao.userId);
  const agora = new Date();

  const carteira = await carregarCarteira(sessao.userId);
  const agenda = await carregarAgendaDoProfissional(sessao.userId, t.partner);
  const { pedidos, proximas } = separarAgenda(agenda, agora);
  const proxima = proximas[0] ?? null;
  const saldo = carteira?.saldo ?? 0;
  const horas = config.limits.pendingExpiresHours;

  return (
    <>
      <PageHeader
        eyebrow={t.professional}
        title={saudacao(nome)}
        description="Sua próxima conversa e o que está esperando resposta."
        actions={
          <ButtonLink href="/parceiros">
            <Icone nome="search" tamanho={15} />
            Encontrar um {t.partner}
          </ButtonLink>
        }
      />

      <div className="flex flex-col gap-[18px]">
        {proxima ? (
          <div className="grid grid-cols-[auto_1fr] items-center gap-[18px] rounded-[14px] border border-[#F3E4EC] bg-white p-[22px] sm:grid-cols-[auto_1fr_auto]">
            <div className="w-[72px] rounded-[10px] border border-[#F3E4EC] pb-2.5 pt-[9px] text-center">
              <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#C2317A]">
                {diaDaSemanaCurto(proxima.inicio, fuso)}
              </div>
              <div className="font-display text-[32px] font-bold leading-none">
                {diaDoMes(proxima.inicio, fuso)}
              </div>
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#8E7C86]">
                Próxima {t.session}
              </div>
              <h2 className="mt-1 text-[26px] capitalize">
                {diaDaSemanaLongo(proxima.inicio, fuso)} · {hora(proxima.inicio, fuso)}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-[#8E7C86]">
                Com <b className="text-[#2A1B26]">{proxima.outro.nome}</b> ·{" "}
                {Math.round((proxima.fim.getTime() - proxima.inicio.getTime()) / 60_000)} minutos
              </p>
            </div>
            <Pill variant="on" className="justify-self-start sm:justify-self-end">
              Confirmada
            </Pill>
          </div>
        ) : (
          <EmptyState
            icone="calendar"
            title={`Nenhuma ${t.session} confirmada`}
            description={
              saldo > 0
                ? `Você tem ${saldo} ${saldo === 1 ? t.ficha : t.fichas}. Cada uma vale uma conversa de 30 minutos com um ${t.partner}.`
                : `Quando o ${t.orgAdmin} da sua empresa distribuir ${t.fichas}, você marca por aqui.`
            }
            action={
              saldo > 0 ? <ButtonLink href="/parceiros">Ver {t.partners}</ButtonLink> : undefined
            }
          />
        )}

        <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.5fr_1fr]">
          <Card
            title="Esperando resposta"
            icone="clock"
            action={
              <Link href="/agenda" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#C2317A]">
                Minha agenda
                <Icone nome="chevron-right" tamanho={13} />
              </Link>
            }
          >
            {pedidos.length === 0 ? (
              <p className="text-[13px] text-[#8E7C86]">Nenhum pedido pendente.</p>
            ) : (
              <ul className="flex flex-col">
                {pedidos.map((s) => {
                  const nome = s.outro.nome.split(/\s+/)[0] || s.outro.nome;
                  return (
                    <LinhaDeSessao
                      key={s.id}
                      sessao={s}
                      fuso={fuso}
                      agora={agora}
                      detalhe={`${nome} tem até ${diaEHora(limiteDeResposta(s, horas), fuso)} para responder. Se não responder, a ${t.ficha} volta para você.`}
                    />
                  );
                })}
              </ul>
            )}
          </Card>

          <div className="flex flex-col gap-[18px]">
            <div className="rounded-[14px] bg-[#FBF1DE] p-[18px]">
              <div className="flex items-center gap-3 font-display text-[38px] font-bold leading-[0.9]">
                {saldo > 0 && <FichaStack count={saldo} max={config.fichaPolicy.maxBalance} />}
                {saldo}
              </div>
              <div className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#8A5D0C]">
                {cap(t.fichas)} disponíveis
                {pedidos.length > 0 && ` · ${pedidos.length} em pedido`}
              </div>
            </div>
            <Note icon={<Icone nome="shield" tamanho={16} />}>
              O {t.orgAdmin} da sua empresa vê quantas {t.fichas} foram usadas no total, mas nunca
              com quem você conversou nem sobre o quê.
            </Note>
          </div>
        </div>
      </div>
    </>
  );
}

function saudacao(nome: string): string {
  const primeiro = nome.trim().split(/\s+/)[0];
  return primeiro ? `Olá, ${primeiro}` : "Olá";
}
