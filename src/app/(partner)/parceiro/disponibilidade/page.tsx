import { DisponibilidadeForm } from "@/components/parceiro/DisponibilidadeForm";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Note } from "@/components/ui/Note";
import { Pill } from "@/components/ui/Pill";
import { requireRole } from "@/lib/auth/session";
import { loadAppConfig } from "@/lib/config/load";
import { DURACAO_DA_SESSAO_MIN, limitesDoMotor } from "@/lib/config/limites";
import {
  carregarExcecoes,
  carregarOcupacoes,
  carregarPerfil,
  carregarRegras,
} from "@/lib/parceiro/dados";
import { paraTexto } from "@/lib/parceiro/horarios";
import { avaliarSlots, type Slot } from "@/lib/scheduling";

/**
 * A disponibilidade do Parceiro, e ao lado **o que o motor faz com ela**.
 *
 * A prévia não é enfeite: entre "atendo terça de manhã" e "estes são os seis
 * horários que alguém pode escolher" há descanso, teto semanal, aviso mínimo e
 * o que já está marcado. Mostrar só o formulário deixaria o Parceiro descobrir
 * o resultado pela reclamação de quem não achou vaga.
 *
 * Invariante 14: os horários abaixo vêm do motor, não de uma conta feita aqui.
 */
export default async function Page() {
  const sessao = await requireRole("partner");
  const config = await loadAppConfig();
  const t = config.terms;

  const perfil = await carregarPerfil(sessao.userId);
  if (perfil === null) {
    return (
      <>
        <PageHeader eyebrow={t.partner} title="Disponibilidade" />
        <EmptyState
          title="Seu cadastro ainda não está completo"
          description="Fale com quem administra a plataforma."
        />
      </>
    );
  }

  const agora = new Date();
  const regras = await carregarRegras(sessao.userId);
  const excecoes = await carregarExcecoes(sessao.userId);
  const ocupacoes = await carregarOcupacoes(sessao.userId, agora);

  const avaliacoes = avaliarSlots({
    agora,
    parceiro: {
      fuso: perfil.fuso,
      bufferMin: perfil.bufferMin,
      maxPorSemana: perfil.maxPorSemana,
      regras,
      excecoes,
    },
    ocupacoes,
    limites: limitesDoMotor(config),
  });

  const livres = avaliacoes.filter((a) => a.recusa === null).map((a) => a.slot);
  const porDia = agrupar(livres, perfil.fuso);

  // A rotina atual, para o formulário abrir com o que já existe. O modo rápido
  // guarda o mesmo intervalo em todos os dias, então a primeira regra basta.
  const primeira = regras[0];

  return (
    <>
      <PageHeader
        eyebrow={t.partner}
        title="Disponibilidade"
        description={`Descreva a sua rotina uma vez. O ${t.professional.toLowerCase()} escolhe dentro dela, respeitando o seu descanso e o seu teto semanal.`}
        actions={
          perfil.status === "active" ? (
            <Pill variant="on">Visível na busca</Pill>
          ) : (
            <Pill variant="wait">Fora da busca</Pill>
          )
        }
      />

      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1fr_1.15fr]">
        <Card title="Sua rotina" icone="calendar-clock">
          <DisponibilidadeForm
            diasIniciais={regras.map((regra) => regra.diaDaSemana)}
            inicioInicial={paraTexto(primeira?.inicioMin ?? 540)}
            fimInicial={paraTexto(primeira?.fimMin ?? 720)}
            maxPorSemana={perfil.maxPorSemana}
            duracaoMin={DURACAO_DA_SESSAO_MIN}
          />
        </Card>

        <div className="flex flex-col gap-[18px]">
          <Card
            title={`Próximos ${config.limits.bookingHorizonDays} dias`}
            action={
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#8E7C86]">
                {livres.length} {livres.length === 1 ? "horário" : "horários"}
              </span>
            }
          >
            {porDia.length === 0 ? (
              <EmptyState
                title="Nenhum horário livre"
                description={
                  regras.length === 0
                    ? "Configure a sua rotina ao lado para aparecer na busca."
                    : "A sua rotina existe, mas nada sobrou depois do descanso, do teto semanal e do que já está marcado."
                }
              />
            ) : (
              <div className="flex flex-col gap-4">
                {porDia.map((dia) => (
                  <div key={dia.chave}>
                    <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#8E7C86]">
                      {dia.rotulo}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {dia.horas.map((hora) => (
                        <span
                          key={hora}
                          className="rounded-[8px] border border-[#F3E4EC] bg-white px-2.5 py-1 font-mono text-[12.5px] tabular-nums"
                        >
                          {hora}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Resumo avaliacoes={avaliacoes} />

          <Note>
            <div>
              Horários no seu fuso (<span className="font-mono">{perfil.fuso}</span>). Quem agenda vê
              no fuso dele — o motor guarda o instante, não o número no relógio.
            </div>
          </Note>
        </div>
      </div>
    </>
  );
}

/**
 * Por que os horários sumiram.
 *
 * O motor devolve o motivo de cada recusa e esta é a tela que os transforma em
 * frase. Sem isso, "nenhum horário livre" é indistinguível de defeito.
 */
function Resumo({ avaliacoes }: { avaliacoes: readonly { recusa: string | null }[] }) {
  const conta = new Map<string, number>();
  for (const { recusa } of avaliacoes) {
    if (recusa === null) continue;
    conta.set(recusa, (conta.get(recusa) ?? 0) + 1);
  }
  if (conta.size === 0) return null;

  const FRASES: Record<string, string> = {
    "fora-do-aviso-minimo": "cedo demais — abaixo da antecedência mínima",
    "fora-do-horizonte": "além do horizonte da agenda",
    ocupado: "já tem sessão marcada",
    descanso: "coladas demais no seu descanso",
    "teto-semanal": "em semanas que já bateram o seu teto",
  };

  return (
    <Card title="Horários que não entraram" icone="clock">
      <ul className="flex flex-col gap-1.5 text-[13px]">
        {[...conta.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([motivo, quantos]) => (
            <li key={motivo} className="flex items-baseline justify-between gap-3">
              <span className="text-[#8E7C86]">{FRASES[motivo] ?? motivo}</span>
              <span className="font-mono tabular-nums">{quantos}</span>
            </li>
          ))}
      </ul>
    </Card>
  );
}

/**
 * Agrupa por dia local do Parceiro.
 *
 * Invariante 2: o instante vira texto só aqui, na borda de UI, e no fuso dele —
 * é a agenda dele que está sendo montada.
 */
function agrupar(slots: readonly Slot[], fuso: string) {
  const dia = new Intl.DateTimeFormat("pt-BR", {
    timeZone: fuso,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
  const hora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: fuso,
    hour: "2-digit",
    minute: "2-digit",
  });

  const mapa = new Map<string, { chave: string; rotulo: string; horas: string[] }>();
  for (const slot of slots) {
    const rotulo = dia.format(slot.inicio);
    const grupo = mapa.get(rotulo) ?? { chave: rotulo, rotulo, horas: [] };
    grupo.horas.push(hora.format(slot.inicio));
    mapa.set(rotulo, grupo);
  }
  return [...mapa.values()];
}
