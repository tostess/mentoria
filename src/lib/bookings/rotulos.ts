import type { PillVariant } from "@/components/ui/Pill";
import type { bookingStatus } from "@/lib/db/schema/enums";

/**
 * O status da sessão como a tela o chama.
 *
 * Tipado pelo próprio enum do esquema, como `ledger/rotulos.ts`: um status novo
 * no Postgres sem rótulo aqui deixa de compilar em vez de aparecer cru.
 *
 * `cancelled` tem dois nomes porque tem duas histórias. Na P4 só o Parceiro
 * cancela — é a recusa —, e quem lê precisa saber isso: "recusada" diz que a
 * ficha voltou porque o Parceiro não pôde; "cancelada" fica para quando o
 * cancelamento do Profissional existir (F7).
 */

export type StatusDaSessao = (typeof bookingStatus.enumValues)[number];

export const STATUS: Record<StatusDaSessao, { rotulo: string; variante: PillVariant }> = {
  pending: { rotulo: "Aguardando", variante: "wait" },
  confirmed: { rotulo: "Confirmada", variante: "on" },
  done: { rotulo: "Realizada", variante: "off" },
  cancelled: { rotulo: "Cancelada", variante: "off" },
  no_show_professional: { rotulo: "Falta", variante: "bad" },
  no_show_partner: { rotulo: "Não atendida", variante: "bad" },
  expired: { rotulo: "Expirada", variante: "off" },
};

export function rotuloDoStatus(
  status: string,
  recusadaPeloParceiro: boolean,
): { rotulo: string; variante: PillVariant } {
  if (status === "cancelled" && recusadaPeloParceiro) return { rotulo: "Recusada", variante: "bad" };
  if (Object.hasOwn(STATUS, status)) return STATUS[status as StatusDaSessao];
  return { rotulo: "Encerrada", variante: "off" };
}

/** Sessão que ainda vai acontecer ou espera resposta — o resto é histórico. */
export function ehAtiva(status: string): boolean {
  return status === "pending" || status === "confirmed";
}
