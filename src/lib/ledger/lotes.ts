import type postgres from "postgres";

/**
 * Lotes de ficha comprada — a validade de 12 meses da conta pessoal.
 *
 * O restante de um lote **não é guardado**: é a soma dos lançamentos de
 * `wallet_ledger` que apontam para ele (`lot_id`). O crédito soma o lote
 * inteiro, o gasto tira 1, o estorno devolve 1 e a baixa do vencimento tira o
 * que sobrou. Uma coluna de restante seria a segunda verdade sobre a mesma
 * coisa, e a baixa tiraria da carteira um número que pode não existir.
 *
 * O que mantém a conta fechando é uma regra só, aplicada pelo gasto: **ficha
 * sem lote só sai quando nenhum lote tem ficha**. Com ela, o saldo da carteira é
 * sempre a soma dos restantes dos lotes mais um resto sem lote que nunca fica
 * negativo — e a baixa de um lote nunca leva o saldo abaixo de zero.
 *
 * Sem `server-only`: recebe a transação de quem já a tem, como `operacoes.ts`.
 */

type Consulta = postgres.TransactionSql | postgres.Sql;

/**
 * De qual lote sai a ficha deste gasto: o que vence primeiro, entre os que
 * ainda têm o bastante. Null quando nenhum tem — a carteira de empresa, que
 * nunca tem lote, ou a ficha que veio de presente, compensação ou estorno de
 * lote já vencido.
 *
 * Lote vencido e ainda não baixado também conta. A validade é aplicada pela
 * baixa diária; até ela rodar a ficha ainda vale, e gastá-la primeiro é o que o
 * Profissional escolheria. Quem chama já travou a carteira, então duas reservas
 * simultâneas não escolhem a mesma última ficha de um lote.
 */
export async function loteParaGasto(
  tx: postgres.TransactionSql,
  userId: string,
  quantidade: number,
): Promise<string | null> {
  const [lote] = await tx<{ id: string }[]>`
    select l.id
      from ficha_lots l
     where l.user_id = ${userId}
       and (select coalesce(sum(w.amount), 0) from wallet_ledger w where w.lot_id = l.id)
           >= ${quantidade}
     order by l.expires_at, l.created_at
     limit 1`;
  return lote?.id ?? null;
}

export type LoteComRestante = {
  id: string;
  paymentId: string;
  fichas: number;
  restante: number;
  venceEm: Date;
  criadoEm: Date;
};

/** Os lotes de uma carteira, do que vence primeiro ao último, com o que sobrou de cada. */
export async function lotesDaCarteira(sql: Consulta, userId: string): Promise<LoteComRestante[]> {
  const linhas = await sql<
    {
      id: string;
      payment_id: string;
      fichas: number;
      restante: number;
      expires_at: string;
      created_at: string;
    }[]
  >`
    select l.id, l.payment_id, l.fichas,
           (select coalesce(sum(w.amount), 0) from wallet_ledger w where w.lot_id = l.id)::int
             as restante,
           l.expires_at, l.created_at
      from ficha_lots l
     where l.user_id = ${userId}
     order by l.expires_at, l.created_at`;

  return linhas.map((l) => ({
    id: l.id,
    paymentId: l.payment_id,
    fichas: l.fichas,
    restante: l.restante,
    venceEm: new Date(l.expires_at),
    criadoEm: new Date(l.created_at),
  }));
}
