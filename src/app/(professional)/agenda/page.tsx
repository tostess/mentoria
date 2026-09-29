import type { ReactNode } from "react";
import { botaoDaSala, quandoAbreASala } from "@/components/agenda/EntrarNaSala";
import { LinhaDeSessao } from "@/components/agenda/LinhaDeSessao";
import {
  juntar,
  ofertaDeCancelamento,
  type PoliticaDoCancelamento,
} from "@/components/agenda/OfertaDeCancelamento";
import { PageHeader } from "@/components/shell/PageHeader";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Ficha } from "@/components/ui/Ficha";
import { Icone } from "@/components/ui/Icone";
import { Note } from "@/components/ui/Note";
import { requireRole } from "@/lib/auth/session";
import { foiRecusa, limiteDeResposta, separarAgenda, type SessaoNaAgenda } from "@/lib/bookings/agenda";
import { loadAppConfig } from "@/lib/config/load";
import { diaEHora, rotuloDoFuso } from "@/lib/formato";
import {
  carregarAgendaDoProfissional,
  carregarFuso,
  movimentosPorSessao,
  type MovimentosDaSessao,
} from "@/lib/profissional/dados";
import { countFichas, type Terms } from "@/lib/terms";

export const metadata = { title: "Minha agenda" };

/**
 * A agenda do Profissional, pela RLS de `bookings` (dono da sessão).
 *
 * Cada sessão futura tem "Cancelar" até a sala abrir (F7), com a frase do prazo
 * em que se está. O que aconteceu com a ficha — estorno, compensação, presente —
 * é dito em frase no histórico, lido do extrato e não deduzido do status,
 * porque "e a minha ficha?" é a pergunta que a pessoa faz ao ver o status.
 */
export default async function Page() {
  const sessao = await requireRole("professional");
  const config = await loadAppConfig();
  const t = config.terms;
  const fuso = await carregarFuso(sessao.userId);
  const agora = new Date();

  const agenda = await carregarAgendaDoProfissional(sessao.userId, t.partner);
  const movimentos = await movimentosPorSessao(sessao.userId);
  const { pedidos, proximas, anteriores } = separarAgenda(agenda, agora);
  const futuras = [...pedidos, ...proximas].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const horas = config.limits.pendingExpiresHours;
  const visao = { lado: "professional", parceiro: t.partner } as const;
  const bonus = config.fichaPolicy.partnerNoShowBonus;
  const politica: PoliticaDoCancelamento = {
    janelaHoras: config.fichaPolicy.cancelWindowHours,
    compensacao: bonus,
  };

  return (
    <>
      <PageHeader
        eyebrow={t.professional}
        title="Minha agenda"
        description={`Horários no seu fuso (${rotuloDoFuso(fuso)}).`}
        actions={
          <ButtonLink href="/parceiros" variant="ghost">
            <Icone nome="search" tamanho={15} />
            {agenda.length === 0 ? `Encontrar um ${t.partner}` : "Marcar outra"}
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-[18px]">
          <Card title="Próximas">
            {futuras.length === 0 ? (
              <EmptyState
                icone="calendar"
                title={`Nenhuma ${t.session} marcada`}
                description={`Escolha um ${t.partner} e um horário — cada ${t.session} usa uma ${t.ficha}.`}
              />
            ) : (
              <ul className="flex flex-col">
                {futuras.map((s) => (
                  <LinhaDeSessao
                    key={s.id}
                    sessao={s}
                    fuso={fuso}
                    agora={agora}
                    visao={visao}
                    direita={botaoDaSala(s, agora)}
                    detalhe={juntar(
                      s.status === "pending"
                        ? `Aguardando ${primeiroNome(s)} até ${diaEHora(limiteDeResposta(s, horas), fuso)}.`
                        : quandoAbreASala(s, agora, fuso),
                      ofertaDeCancelamento(s, "professional", agora, politica, t, fuso),
                    )}
                  />
                ))}
              </ul>
            )}
          </Card>

          {anteriores.length > 0 && (
            <Card title="Anteriores">
              <ul className="flex flex-col">
                {anteriores.map((s) => (
                  <LinhaDeSessao
                    key={s.id}
                    sessao={s}
                    fuso={fuso}
                    agora={agora}
                    visao={visao}
                    direita={botaoDaSala(s, agora)}
                    detalhe={detalheDoHistorico(s, t, movimentos.get(s.id))}
                  />
                ))}
              </ul>
            </Card>
          )}
        </div>

        <Note icon={<Icone nome="info" tamanho={16} />}>
          A sala da {t.session} abre aqui, 10 minutos antes do horário, e fecha 5 minutos depois do
          fim. Dá para cancelar até a sala abrir: com mais de {politica.janelaHoras} horas de
          antecedência a {t.ficha} volta; depois disso o horário fica livre, mas a {t.ficha} conta
          como usada.
        </Note>
      </div>
    </>
  );
}

function primeiroNome(s: SessaoNaAgenda): string {
  return s.outro.nome.split(/\s+/)[0] || s.outro.nome;
}

function detalheDoHistorico(
  s: SessaoNaAgenda,
  t: Terms,
  movimentos: MovimentosDaSessao | undefined,
): ReactNode {
  const estornou = movimentos?.estorno === true;
  const compensacao = movimentos?.compensacao ?? 0;
  const comCompensacao = (frase: string) =>
    compensacao > 0 ? `${frase}, e você ganhou mais ${countFichas(compensacao, t)} pelo transtorno.` : `${frase}.`;

  if (s.status === "cancelled") {
    if (foiRecusa(s)) return `${primeiroNome(s)} não pôde atender. A ${t.ficha} voltou para você.`;
    if (s.cancelamento?.por === "partner") {
      return comCompensacao(`${primeiroNome(s)} cancelou a ${t.session}. A ${t.ficha} voltou para você`);
    }
    if (s.cancelamento?.por === "professional") {
      if (s.cancelamento.eraPedido) return `Você cancelou o pedido. A ${t.ficha} voltou para você.`;
      return estornou
        ? `Você cancelou a tempo. A ${t.ficha} voltou para você.`
        : `Você cancelou depois do prazo, e a ${t.ficha} foi usada.`;
    }
  }
  if (s.status === "expired") return `Sem resposta a tempo. A ${t.ficha} voltou para você.`;

  const frases: ReactNode[] = [];
  if (s.status === "no_show_partner") {
    frases.push(comCompensacao(`${primeiroNome(s)} não entrou na sala. Sua ${t.ficha} voltou`));
  }
  if (s.status === "no_show_professional") {
    frases.push(
      `A sala não registrou sua entrada, e a ${t.ficha} foi usada. Se você entrou, fale com a ${t.admin.toLowerCase()}.`,
    );
  }
  if (movimentos?.presente) {
    frases.push(
      <span key="presente" className="inline-flex items-center gap-1.5">
        <Ficha size="s" />
        {primeiroNome(s)} te deu 1 {t.ficha} de presente.
      </span>,
    );
  }
  if (frases.length === 0) return undefined;
  return frases.length === 1 ? frases[0] : <span className="flex flex-col gap-1">{frases}</span>;
}
