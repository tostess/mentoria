/**
 * Quantas fichas viraram sessão, contadas a partir dos lançamentos da carteira.
 *
 * Gasto menos estorno: pedido recusado ou expirado sai da carteira e volta, e
 * não é uso. É a mesma conta de `org_usage.fichas_used`, do lado de quem gastou.
 * Presente, alocação e compensação entram na carteira e não mexem aqui.
 *
 * Quem chama costuma passar uma janela do extrato, não ele inteiro; um estorno
 * cujo gasto ficou fora da janela deixaria a conta negativa, e negativo vira 0.
 */
export function fichasUsadas(lancamentos: readonly { tipo: string; quantidade: number }[]): number {
  const liquido = lancamentos
    .filter((l) => l.tipo === "spend" || l.tipo === "refund")
    .reduce((soma, l) => soma - l.quantidade, 0);
  return Math.max(0, liquido);
}
