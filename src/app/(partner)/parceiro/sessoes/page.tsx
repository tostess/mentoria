import type { ReactNode } from "react";
import { botaoDaSala, quandoAbreASala } from "@/components/agenda/EntrarNaSala";
import { LinhaDeSessao } from "@/components/agenda/LinhaDeSessao";
import {
  juntar,
  ofertaDeCancelamento,
  type PoliticaDoCancelamento,
} from "@/components/agenda/OfertaDeCancelamento";
import { CorrecaoDePresenca } from "@/components/parceiro/CorrecaoDePresenca";
import { RespostaAoPedido } from "@/components/parceiro/RespostaAoPedido";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Ficha } from "@/components/ui/Ficha";
import { Icone } from "@/components/ui/Icone";
import { Note } from "@/components/ui/Note";
import { requireRole } from "@/lib/auth/session";
import { movimentosDoParceiro } from "@/lib/bookings";
import { foiRecusa, limiteDeResposta, separarAgenda, type SessaoNaAgenda } from "@/lib/bookings/agenda";
import type { Visao } from "@/lib/bookings/rotulos";
import { loadAppConfig } from "@/lib/config/load";
import { prazoRestante, rotuloDoFuso } from "@/lib/formato";
import { carregarPerfil } from "@/lib/parceiro/dados";
import { carregarSessoesDoParceiro } from "@/lib/parceiro/sessoes";
import { cap, countFichas, type Terms } from "@/lib/terms";

export const metadata = { title: "Sessões" };

/** Abaixo disso o prazo de resposta aparece em ouro. */
const HORAS_URGENTE = 12;

/**
 * As sessões do Parceiro: o que pede resposta dele primeiro, depois o que vem
 * pela frente e o histórico.
 *
 * Tudo pela sessão dele — `bookings` pela policy de participante, quem pediu
 * pela view `partner_professionals`. Confirmar, recusar e cancelar vão a Route
 * Handlers com `service_role` (invariante 4), com o `partner_id` tirado do JWT.
 */
export default async function Page() {
  const sessao = await requireRole("partner");
  const config = await loadAppConfig();
  const t = config.terms;
  const agora = new Date();

  const perfil = await carregarPerfil(sessao.userId);
  const fuso = perfil?.fuso ?? "America/Sao_Paulo";
  const sessoes = await carregarSessoesDoParceiro(sessao.userId, t.professional);
  const { presentes, compensadas } = await movimentosDoParceiro(sessao.userId);
  const { pedidos, proximas, anteriores } = separarAgenda(sessoes, agora);
  const horas = config.limits.pendingExpiresHours;
  const visao: Visao = { lado: "partner", parceiro: t.partner };
  const politica: PoliticaDoCancelamento = {
    janelaHoras: config.fichaPolicy.cancelWindowHours,
    compensacao: config.fichaPolicy.partnerNoShowBonus,
  };

  return (
    <>
      <PageHeader
        eyebrow={t.partner}
        title={cap(t.sessions)}
        description={`Horários no seu fuso (${rotuloDoFuso(fuso)}). Pedido sem resposta em ${horas} horas expira, e a ${t.ficha} volta para quem pediu.`}
      />

      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-[18px]">
          <Card
            title="Esperando sua resposta"
            icone="inbox"
            action={
              pedidos.length > 0 ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#8E7C86]">
                  {pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"}
                </span>
              ) : undefined
            }
          >
            {pedidos.length === 0 ? (
              <p className="text-[13px] text-[#8E7C86]">Nenhum pedido esperando você.</p>
            ) : (
              <ul className="flex flex-col">
                {pedidos.map((s) => {
                  const limite = limiteDeResposta(s, horas);
                  return (
                    <LinhaDeSessao
                      key={s.id}
                      sessao={s}
                      fuso={fuso}
                      agora={agora}
                      direita={
                        <RespostaAoPedido
                          bookingId={s.id}
                          primeiroNome={s.outro.nome.split(/\s+/)[0] || s.outro.nome}
                          prazo={prazoRestante(limite, agora)}
                          urgente={limite.getTime() - agora.getTime() < HORAS_URGENTE * 3_600_000}
                          termoFicha={t.ficha}
                        />
                      }
                    />
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Próximas">
            {proximas.length === 0 ? (
              <EmptyState
                icone="calendar"
                title={`Nenhuma ${t.session} confirmada`}
                description={`Quando você confirmar um pedido, a ${t.session} aparece aqui.`}
              />
            ) : (
              <ul className="flex flex-col">
                {proximas.map((s) => (
                  <LinhaDeSessao
                    key={s.id}
                    sessao={s}
                    fuso={fuso}
                    agora={agora}
                    visao={visao}
                    direita={botaoDaSala(s, agora)}
                    detalhe={juntar(
                      quandoAbreASala(s, agora, fuso),
                      ofertaDeCancelamento(s, "partner", agora, politica, t, fuso),
                    )}
                  />
                ))}
              </ul>
            )}
          </Card>

          {anteriores.length > 0 && (
            <Card title="Anteriores">
              <ul className="flex flex-col">
                {anteriores.slice(0, 30).map((s) => (
                  <LinhaDeSessao
                    key={s.id}
                    sessao={s}
                    fuso={fuso}
                    agora={agora}
                    visao={visao}
                    direita={botaoDaSala(s, agora)}
                    detalhe={detalheDoHistorico(s, t, presentes.has(s.id), compensadas.has(s.id))}
                  />
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-[18px]">
          <Note icon={<Icone nome="info" tamanho={16} />}>
            Recusar devolve a {t.ficha} a quem pediu na mesma hora e libera o horário na sua agenda.
            Quem pediu não vê motivo — só que você não pôde atender.
          </Note>
          <Note icon={<Icone nome="calendar" tamanho={16} />}>
            Imprevisto? Dá para cancelar uma {t.session} confirmada até a sala abrir, e a {t.ficha}{" "}
            volta para quem ia participar. Com menos de {politica.janelaHoras} horas de antecedência
            conta como falta avisada
            {politica.compensacao > 0 && <>: quem ia participar ganha mais {countFichas(politica.compensacao, t)}</>}
            . A pessoa vê o cancelamento na agenda — ainda não há aviso por e-mail.
          </Note>
          <Note icon={<Icone nome="video" tamanho={16} />}>
            A presença é lida da sala 15 minutos depois do fim. Se ela deu como ausente alguém que
            participou, corrija na {t.session} — fica registrado no histórico da{" "}
            {t.admin.toLowerCase()}.
          </Note>
        </div>
      </div>
    </>
  );
}

function primeiroNome(s: SessaoNaAgenda): string {
  return s.outro.nome.split(/\s+/)[0] || s.outro.nome;
}

/**
 * O que a sala disse, o presente, e — quando ela deu o Profissional como
 * ausente — o "participou, sim" logo abaixo da frase que ele responde. Fica na
 * coluna do meio, e não na do selo, porque a confirmação aberta precisa de
 * largura para ser lida.
 */
function detalheDoHistorico(
  s: SessaoNaAgenda,
  t: Terms,
  deuPresente: boolean,
  compensada: boolean,
): ReactNode {
  if (s.status === "cancelled" && !foiRecusa(s)) {
    if (s.cancelamento?.por === "partner") {
      return compensada
        ? `Você cancelou em cima da hora. A ${t.ficha} voltou para ${primeiroNome(s)}, com compensação.`
        : `Você cancelou. A ${t.ficha} voltou para ${primeiroNome(s)}.`;
    }
    if (s.cancelamento?.por === "professional") {
      return s.cancelamento.eraPedido
        ? `${primeiroNome(s)} cancelou o pedido.`
        : `${primeiroNome(s)} cancelou a ${t.session}.`;
    }
  }

  const frases: ReactNode[] = [];
  if (s.status === "no_show_professional") {
    frases.push(
      <span key="ausente" className="flex flex-col items-start gap-1.5">
        A sala não registrou a entrada de {primeiroNome(s)}.
        <CorrecaoDePresenca bookingId={s.id} primeiroNome={primeiroNome(s)} />
      </span>,
    );
  }
  if (s.status === "no_show_partner") {
    frases.push(
      `A sala não registrou sua entrada, e a ${t.ficha} voltou para ${primeiroNome(s)}. Se você entrou, fale com a ${t.admin.toLowerCase()}.`,
    );
  }
  if (deuPresente) {
    frases.push(
      <span key="presente" className="inline-flex items-center gap-1.5">
        <Ficha size="s" />
        Você deu 1 {t.ficha} de presente.
      </span>,
    );
  }
  if (frases.length === 0) return undefined;
  return frases.length === 1 ? frases[0] : <span className="flex flex-col gap-1">{frases}</span>;
}
