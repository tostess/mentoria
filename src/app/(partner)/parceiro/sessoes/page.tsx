import { LinhaDeSessao } from "@/components/agenda/LinhaDeSessao";
import { RespostaAoPedido } from "@/components/parceiro/RespostaAoPedido";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icone } from "@/components/ui/Icone";
import { Note } from "@/components/ui/Note";
import { requireRole } from "@/lib/auth/session";
import { limiteDeResposta, separarAgenda } from "@/lib/bookings/agenda";
import { loadAppConfig } from "@/lib/config/load";
import { prazoRestante, rotuloDoFuso } from "@/lib/formato";
import { carregarPerfil } from "@/lib/parceiro/dados";
import { carregarSessoesDoParceiro } from "@/lib/parceiro/sessoes";
import { cap } from "@/lib/terms";

export const metadata = { title: "Sessões" };

/** Abaixo disso o prazo de resposta aparece em ouro. */
const HORAS_URGENTE = 12;

/**
 * As sessões do Parceiro: o que pede resposta dele primeiro, depois o que vem
 * pela frente e o histórico.
 *
 * Tudo pela sessão dele — `bookings` pela policy de participante, quem pediu
 * pela view `partner_professionals`. Confirmar e recusar vão a Route Handlers
 * com `service_role` (invariante 4), com o `partner_id` tirado do JWT.
 */
export default async function Page() {
  const sessao = await requireRole("partner");
  const config = await loadAppConfig();
  const t = config.terms;
  const agora = new Date();

  const perfil = await carregarPerfil(sessao.userId);
  const fuso = perfil?.fuso ?? "America/Sao_Paulo";
  const sessoes = await carregarSessoesDoParceiro(sessao.userId, t.professional);
  const { pedidos, proximas, anteriores } = separarAgenda(sessoes, agora);
  const horas = config.limits.pendingExpiresHours;

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
                  <LinhaDeSessao key={s.id} sessao={s} fuso={fuso} agora={agora} />
                ))}
              </ul>
            )}
          </Card>

          {anteriores.length > 0 && (
            <Card title="Anteriores">
              <ul className="flex flex-col">
                {anteriores.slice(0, 30).map((s) => (
                  <LinhaDeSessao key={s.id} sessao={s} fuso={fuso} agora={agora} />
                ))}
              </ul>
            </Card>
          )}
        </div>

        <Note icon={<Icone nome="info" tamanho={16} />}>
          Recusar devolve a {t.ficha} a quem pediu na mesma hora e libera o horário na sua agenda.
          Quem pediu não vê motivo — só que você não pôde atender.
        </Note>
      </div>
    </>
  );
}
