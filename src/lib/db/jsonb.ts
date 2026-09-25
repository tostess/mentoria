/**
 * Como escrever numa coluna `jsonb` pelo postgres.js — de um jeito só, porque
 * os jeitos óbvios funcionam em um ambiente e falham no outro.
 *
 * Medido contra o `mentoria-dev` nas três situações em que o projeto roda:
 *
 * | forma                      | Node 5432 prepare | Node 6543 sem prepare | dentro do Next |
 * |----------------------------|-------------------|-----------------------|----------------|
 * | `tx.json(obj)::jsonb`      | objeto            | objeto                | **estoura**    |
 * | `${JSON.stringify(x)}::jsonb` | string jsonb   | string jsonb          | objeto         |
 * | `${JSON.stringify(x)}::text::jsonb` | objeto   | objeto                | objeto         |
 *
 * As duas primeiras linhas são armadilhas de verdade: `tx.json()` é o que a
 * documentação do postgres.js manda usar e passa nos testes, mas dentro do
 * bundle do Next o parâmetro `{value, type, array}` não é serializado e a
 * chamada morre com `ERR_INVALID_ARG_TYPE`. E `::jsonb` direto grava a string
 * JSON *como* valor jsonb — o dado entra torto, sem erro nenhum, e só aparece
 * quando alguém tenta ler `branding->>'accent'` e recebe nada.
 *
 * O `::text` no meio é o truque: ele tira do postgres.js a inferência de que o
 * parâmetro é json, então o driver manda texto puro e quem monta o jsonb é o
 * Postgres. Igual nos três ambientes.
 *
 * Módulo puro — nenhuma conexão, nenhum segredo.
 */

/**
 * Valor para uma coluna `jsonb`. **Sempre** interpolado com `::text::jsonb`:
 *
 * ```ts
 * await tx`insert into orgs (branding) values (${paraJsonb(branding)}::text::jsonb)`;
 * ```
 *
 * `null` e `undefined` viram `NULL` — `null::text::jsonb` é NULL, não o jsonb
 * `'null'`.
 */
export function paraJsonb(valor: unknown): string | null {
  return valor === undefined || valor === null ? null : JSON.stringify(valor);
}
