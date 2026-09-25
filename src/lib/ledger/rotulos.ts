import type { NomeIcone } from "@/components/ui/icones";
import { ledgerType } from "@/lib/db/schema/enums";
import { humanizar } from "@/lib/humanizar";

/**
 * Os tipos de lançamento como a tela os chama.
 *
 * O enum `ledger_type` é inglês e é do banco — `purchase`, `allocate` — e
 * aparecia assim no livro-caixa da empresa. O registro abaixo é tipado pelo
 * próprio enum do esquema: um tipo novo no Postgres sem rótulo aqui deixa de
 * compilar, em vez de surgir cru na tela.
 */

export type TipoDeLancamento = (typeof ledgerType.enumValues)[number];

export const LANCAMENTOS: Record<TipoDeLancamento, { rotulo: string; icone: NomeIcone }> = {
  purchase: { rotulo: "Compra", icone: "contract" },
  allocate: { rotulo: "Alocação", icone: "coins" },
  spend: { rotulo: "Sessão", icone: "calendar" },
  refund: { rotulo: "Estorno", icone: "refund" },
  gift: { rotulo: "Presente", icone: "coins" },
  reclaim: { rotulo: "Devolução", icone: "refund" },
  adjust: { rotulo: "Ajuste", icone: "pencil" },
};

export function rotuloDoLancamento(tipo: string): { rotulo: string; icone: NomeIcone } {
  if (Object.hasOwn(LANCAMENTOS, tipo)) return LANCAMENTOS[tipo as TipoDeLancamento];
  return { rotulo: humanizar(tipo), icone: "history" };
}
