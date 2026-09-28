import Link from "next/link";
import { botaoDaSala, quandoAbreASala } from "@/components/agenda/EntrarNaSala";
import { LinhaDeSessao } from "@/components/agenda/LinhaDeSessao";
import { PageHeader } from "@/components/shell/PageHeader";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icone } from "@/components/ui/Icone";
import { Stat } from "@/components/ui/Stat";
import { requireRole } from "@/lib/auth/session";
import { ehAtiva } from "@/lib/bookings/rotulos";
import { separarAgenda } from "@/lib/bookings/agenda";
import { loadAppConfig } from "@/lib/config/load";
import { carregarPerfil, carregarRegras } from "@/lib/parceiro/dados";
import { resumoDasRegras } from "@/lib/parceiro/horarios";
import { carregarSessoesDoParceiro } from "@/lib/parceiro/sessoes";
import { chaveDaSemana } from "@/lib/scheduling";
import { cap } from "@/lib/terms";

export const metadata = { title: "Início" };

const SETE_DIAS = 7 * 24 * 3_600_000;

/**
 * O início do Parceiro: o que pede resposta, o que vem pela frente, e quanto da
 * semana já está tomado.
 *
 * "Nesta semana" conta como o motor conta o teto: domingo a sábado no fuso do
 * Parceiro (`chaveDaSemana`), sessões pendentes e confirmadas. Contar de outro
 * jeito faria o número daqui discordar do motivo "teto semanal" que a tela de
 * disponibilidade mostra.
 */
export default async function Page() {
  const sessao = await requireRole("partner");
  const config = await loadAppConfig();
  const t = config.terms;
  const agora = new Date();

  const perfil = await carregarPerfil(sessao.userId);
  const fuso = perfil?.fuso ?? "America/Sao_Paulo";
  const regras = await carregarRegras(sessao.userId);
  const sessoes = await carregarSessoesDoParceiro(sessao.userId, t.professional);
  const { pedidos, proximas } = separarAgenda(sessoes, agora);

  const semana = chaveDaSemana(agora, fuso);
  const nestaSemana = sessoes.filter(
    (s) => ehAtiva(s.status) && chaveDaSemana(s.inicio, fuso) === semana,
  ).length;
  const teto = perfil?.maxPorSemana ?? 4;
  const emSeteDias = proximas.filter((s) => s.inicio.getTime() - agora.getTime() < SETE_DIAS).length;
  const primeiroNome = perfil?.nome.split(/\s+/)[0];

  return (
    <>
      <PageHeader
        eyebrow={t.partner}
        title={primeiroNome ? `Olá, ${primeiroNome}` : "Olá"}
        description="O que pede resposta sua e o que vem pela frente."
      />

      <div className="flex flex-col gap-[18px]">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <Link
            href="/parceiro/sessoes"
            className="rounded-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C2317A]"
          >
            <Stat
              value={pedidos.length}
              label={pedidos.length === 1 ? "Pedido esperando você" : "Pedidos esperando você"}
              icone="inbox"
              className={pedidos.length > 0 ? "border-[#E7B3CC]" : ""}
            />
          </Link>
          <Stat value={emSeteDias} label={`${t.sessions} nos próximos 7 dias`} icone="calendar" />
          <div className="relative rounded-[14px] border border-[#F3E4EC] bg-white p-[18px]">
            <Icone nome="clock" tamanho={20} className="absolute right-4 top-4 text-[#D9C3CF]" />
            <div className="font-display text-[38px] font-bold leading-[0.9]">
              {nestaSemana}
              <span className="text-[22px] text-[#8E7C86]"> / {teto}</span>
            </div>
            <div className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#8E7C86]">
              nesta semana (dom–sáb)
            </div>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#F3E4EC]">
              <div
                className="h-full rounded-full bg-[#C2317A]"
                style={{ width: `${Math.min(100, Math.round((nestaSemana / Math.max(1, teto)) * 100))}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1.5fr_1fr]">
          <Card
            title={`Próximas ${t.sessions}`}
            action={
              <Link
                href="/parceiro/sessoes"
                className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#C2317A]"
              >
                Todas
                <Icone nome="chevron-right" tamanho={13} />
              </Link>
            }
          >
            {proximas.length === 0 ? (
              <EmptyState
                icone="calendar"
                title={`Nenhuma ${t.session} confirmada`}
                description={
                  pedidos.length > 0
                    ? "Há pedidos esperando sua resposta."
                    : `Quando um ${t.professional} pedir um horário seu, o pedido aparece em ${cap(t.sessions)}.`
                }
              />
            ) : (
              <ul className="flex flex-col">
                {proximas.slice(0, 4).map((s) => (
                  <LinhaDeSessao
                    key={s.id}
                    sessao={s}
                    fuso={fuso}
                    agora={agora}
                    visao={{ lado: "partner", parceiro: t.partner }}
                    direita={botaoDaSala(s, agora)}
                    detalhe={quandoAbreASala(s, agora, fuso)}
                  />
                ))}
              </ul>
            )}
          </Card>

          <Card title="Sua agenda aberta" icone="calendar-clock">
            <p className="text-[12.5px] leading-[1.5] text-[#8E7C86]">
              {resumoDasRegras(regras)}
              {regras.length > 0 && perfil && (
                <>
                  {" "}
                  · descanso de {perfil.bufferMin} min · até {teto} por semana.
                </>
              )}
            </p>
            <ButtonLink href="/parceiro/disponibilidade" variant="ghost" size="sm" className="mt-3">
              Ajustar disponibilidade
            </ButtonLink>
          </Card>
        </div>
      </div>
    </>
  );
}
