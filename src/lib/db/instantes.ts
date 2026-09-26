/**
 * Como passar um instante para o Postgres pelo postgres.js.
 *
 * Segunda armadilha da mesma família da de `jsonb.ts`, e descoberta do mesmo
 * jeito: só rodando a aplicação. Interpolar um `Date` direto no template
 * funciona em Node puro — e portanto passa em todo teste da suíte — e **estoura
 * dentro do bundle do Next** com
 * `ERR_INVALID_ARG_TYPE: Received an instance of Date`.
 *
 * | forma                            | Node (teste) | dentro do Next |
 * |----------------------------------|--------------|----------------|
 * | `${data}` (Date)                 | funciona     | **estoura**    |
 * | `${data.toISOString()}`          | funciona     | funciona, mas o tipo fica a cargo da inferência |
 * | `${paraInstante(data)}::text::timestamptz` | funciona | funciona |
 *
 * O `::text` no meio é o mesmo truque do jsonb: tira do driver a inferência de
 * tipo, então ele manda texto puro e quem interpreta é o Postgres. ISO-8601 com
 * `Z` é entendido sem ambiguidade de fuso.
 *
 * Módulo puro — nenhuma conexão, nenhum segredo.
 */

/**
 * Instante para coluna `timestamptz`. **Sempre** interpolado com
 * `::text::timestamptz`:
 *
 * ```ts
 * await tx`... where end_at >= ${paraInstante(desde)}::text::timestamptz`;
 * ```
 *
 * `null` e `undefined` viram `NULL`.
 */
export function paraInstante(valor: Date | null | undefined): string | null {
  if (valor === undefined || valor === null) return null;
  if (Number.isNaN(valor.getTime())) {
    throw new Error("instante inválido: Date com valor NaN");
  }
  return valor.toISOString();
}
