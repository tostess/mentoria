import "server-only";

import { getSql } from "@/lib/db";
import type { FichaPolicy } from "@/lib/config/app-config";
import { comTraducao } from "./erros";
import { acessoDaConexao, recargaNaConexao, type ResultadoDaRecarga } from "./mensal";
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
export type { ResultadoDaRecarga, ResultadoPorEmpresa } from "./mensal";

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

/**
 * A recarga do dia 1º, na conexão de verdade.
 *
 * Sem `comTraducao` em volta: a rodada trata cada recusa por pessoa lá dentro —
 * chave repetida é "já recebeu", saldo insuficiente é "contrato acabou" — e
 * traduzir aqui transformaria a primeira recusa individual em falha da rodada.
 */
export async function alocarMesTodo(opcoes: {
  agora: Date;
  fichaPolicy: FichaPolicy;
}): Promise<ResultadoDaRecarga> {
  return recargaNaConexao(acessoDaConexao(getSql()), opcoes);
}
