import type { PillVariant } from "@/components/ui/Pill";
import type { bookingStatus } from "@/lib/db/schema/enums";
import { cap } from "@/lib/terms";

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

/**
 * Quem está olhando. A falta muda de nome com o lado: quem faltou lê "Você não
 * entrou"; quem ficou esperando lê que o outro faltou. O termo do Parceiro vem
 * de quem chama, porque este módulo não lê vocabulário.
 */
export type Visao = { lado: "professional" | "partner"; parceiro: string };

export function rotuloDoStatus(
  status: string,
  recusadaPeloParceiro: boolean,
  visao?: Visao,
): { rotulo: string; variante: PillVariant } {
  if (status === "cancelled" && recusadaPeloParceiro) return { rotulo: "Recusada", variante: "bad" };
  if (visao !== undefined && (status === "no_show_partner" || status === "no_show_professional")) {
    const faltouQuemOlha = (status === "no_show_partner") === (visao.lado === "partner");
    if (faltouQuemOlha) return { rotulo: "Você não entrou", variante: "wait" };
    return visao.lado === "professional"
      ? { rotulo: `${cap(visao.parceiro)} faltou`, variante: "bad" }
      : { rotulo: "Não compareceu", variante: "wait" };
  }
  if (Object.hasOwn(STATUS, status)) return STATUS[status as StatusDaSessao];
  return { rotulo: "Encerrada", variante: "off" };
}

/** Sessão que ainda vai acontecer ou espera resposta — o resto é histórico. */
export function ehAtiva(status: string): boolean {
  return status === "pending" || status === "confirmed";
}
