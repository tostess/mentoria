import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Pill } from "@/components/ui/Pill";
import type { SessaoNaAgenda } from "@/lib/bookings/agenda";
import { rotuloDoStatus, type Visao } from "@/lib/bookings/rotulos";
import { diaDaSemanaCurto, diaDoMes, intervalo } from "@/lib/formato";

/**
 * Uma sessão numa lista: a folhinha do dia, a pessoa do outro lado, o horário
 * e o status.
 *
 * Server Component de propósito: formata no fuso de quem olha sem levar o luxon
 * para o bundle. Quem precisa de botão (confirmar, recusar) passa em `direita`; o que abre
 * confirmação larga (cancelar, corrigir presença) vai em `detalhe`, na coluna do meio.
 */
export function LinhaDeSessao({
  sessao,
  fuso,
  agora,
  detalhe,
  direita,
  visao,
}: {
  sessao: SessaoNaAgenda;
  fuso: string;
  agora: Date;
  /** Frase abaixo do horário — o prazo, o estorno, o motivo. */
  detalhe?: ReactNode;
  /** Substitui o selo de status. */
  direita?: ReactNode;
  /** De que lado da sessão se olha — muda o nome da falta. */
  visao?: Visao;
}) {
  const passada = sessao.fim.getTime() <= agora.getTime();
  const { rotulo, variante } = rotuloDoStatus(sessao.status, sessao.cancelamento, visao);
  const sub = [sessao.outro.cargo, sessao.outro.empresa].filter(Boolean).join(" · ");

  return (
    <li className="grid grid-cols-[52px_1fr] items-center gap-x-3.5 gap-y-2 border-t border-[#F3E4EC] py-[13px] first:border-t-0 first:pt-0 sm:grid-cols-[62px_1fr_auto]">
      <div className="rounded-[10px] border border-[#F3E4EC] bg-white pb-[7px] pt-1.5 text-center">
        <div
          className={`font-mono text-[9px] uppercase tracking-[0.12em] ${passada ? "text-[#8E7C86]" : "text-[#C2317A]"}`}
        >
          {diaDaSemanaCurto(sessao.inicio, fuso)}
        </div>
        <div
          className={`font-display text-[24px] font-bold leading-none ${passada ? "text-[#8E7C86]" : ""}`}
        >
          {diaDoMes(sessao.inicio, fuso)}
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name={sessao.outro.nome} photoUrl={sessao.outro.foto} size="sm" />
        <div className="min-w-0">
          <div className="truncate font-semibold">{sessao.outro.nome}</div>
          <div className="font-mono text-[11px] text-[#8E7C86]">
            {intervalo(sessao.inicio, sessao.fim, fuso)}
          </div>
          {sub && <div className="text-[12.5px] leading-[1.4] text-[#8E7C86]">{sub}</div>}
          {detalhe && <div className="mt-1 text-[12.5px] leading-[1.45] text-[#8E7C86]">{detalhe}</div>}
        </div>
      </div>

      <div className="col-span-2 flex flex-col items-start gap-[7px] sm:col-span-1 sm:items-end">
        {direita ?? <Pill variant={variante}>{rotulo}</Pill>}
      </div>
    </li>
  );
}
