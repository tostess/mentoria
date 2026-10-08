import "server-only";

import { getSql } from "@/lib/db";
import type { Ator } from "@/lib/ledger/operacoes";
import { marcaNaTransacao, type MarcaDaEmpresa } from "./operacoes";

export { EmpresaInexistente, type MarcaDaEmpresa } from "./operacoes";

/** A porta que abre a transação. O SQL mora em `operacoes.ts`. */
export async function salvarMarca(
  orgId: string,
  nova: MarcaDaEmpresa,
  ator: Ator,
  accentDaPlataforma: string,
): Promise<{ campos: string[] }> {
  return getSql().begin((tx) => marcaNaTransacao(tx, orgId, nova, ator, accentDaPlataforma));
}
