import "server-only";

import { getSql } from "@/lib/db";
import { comTraducao } from "./erros";
import { alocacaoNaTransacao, compraNaTransacao, type Alocacao, type Compra } from "./operacoes";

/**
 * A porta de entrada do livro-caixa: abre a transação e traduz a recusa.
 *
 * Invariante 6: reserva e alocação são transações SQL — uma falha derruba
 * tudo. O SQL em si vive em `operacoes.ts`, que recebe a transação; aqui fica
 * só o que precisa de conexão.
 *
 * É de propósito que a transação viva num módulo e não na Server Action: a
 * alocação mensal automática (cron, P3) e a alocação manual do admin precisam
 * ser exatamente a mesma escrita, ou os dois caminhos divergem.
 */

export { SaldoInsuficiente, LancamentoRepetido, TetoDaCarteira } from "./erros";
export type { Alocacao, Compra } from "./operacoes";

export async function registrarCompra(
  compra: Compra,
): Promise<{ saldo: number; contratadas: number }> {
  const sql = getSql();
  return comTraducao(
    () => sql.begin((tx) => compraNaTransacao(tx, compra)),
    "Não foi possível registrar: o lançamento deixaria o contrato negativo.",
  );
}

export async function alocarFichas(
  alocacao: Alocacao,
): Promise<{ saldoContrato: number; saldoCarteira: number }> {
  const sql = getSql();
  return comTraducao(
    () => sql.begin((tx) => alocacaoNaTransacao(tx, alocacao)),
    "O contrato da empresa não tem fichas suficientes.",
  );
}
