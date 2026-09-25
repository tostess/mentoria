import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { requireDatabaseUrl } from "@/lib/env.server";
import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof buildDb>;

/**
 * Uma conexão por processo. Em dev o HMR reavalia o módulo a cada salvamento,
 * então o cache vive no `globalThis` — sem isso o pool do Supabase esgota.
 */
const globalForDb = globalThis as unknown as {
  __mentoriaSql?: ReturnType<typeof postgres>;
  __mentoriaDb?: DrizzleDb;
};

function buildDb() {
  const url = requireDatabaseUrl();

  // Pooler de transação (6543) não guarda estado entre statements: prepared
  // statement quebra. Conexão direta ou session pooler (5432) aceita.
  const pooled = url.includes("pgbouncer=true") || url.includes(":6543");

  /**
   * ATENÇÃO — nunca dispare duas consultas Drizzle em paralelo nesta conexão.
   *
   * No pooler `max` é 1, e num `Promise.all` de duas consultas Drizzle sobre uma
   * conexão **já usada** as duas travam para sempre: a primeira resolve e as
   * outras nunca voltam. Medido contra o `mentoria-dev`, com `execute` e com o
   * construtor de consultas, com `prepare` ligado e desligado. Template cru do
   * postgres.js escapa; Drizzle não.
   *
   * Isso não é perda de desempenho nenhuma: numa conexão só as consultas
   * serializam de qualquer jeito. `await` uma depois da outra.
   *
   * Cuidado com o caso indireto: `Promise.all([f(), g()])` é seguro se `g()`
   * esperar a promessa de `f()` antes de consultar — é o que salva o
   * `app/layout.tsx`, onde `loadTheme()` espera o `loadAppConfig()` cacheado.
   * Reordenar aquele `loadTheme` reintroduz o travamento.
   */

  const sql =
    globalForDb.__mentoriaSql ??
    postgres(url, {
      prepare: !pooled,
      max: pooled ? 1 : 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });

  globalForDb.__mentoriaSql = sql;
  return drizzle(sql, { schema });
}

/**
 * Drizzle sobre o Postgres do Supabase. Conecta como `postgres`, ou seja
 * **fora do RLS** — vale a mesma regra do `service_role`: só no servidor, e
 * toda escrita privilegiada com o escopo checado à mão.
 *
 * Para ler no escopo do usuário, prefira o cliente de `supabase/server.ts`,
 * que carrega o JWT e deixa o banco aplicar a policy.
 *
 * Lazy: `next build` roda sem `DATABASE_URL` e não pode quebrar por isso.
 */
export function getDb(): DrizzleDb {
  globalForDb.__mentoriaDb ??= buildDb();
  return globalForDb.__mentoriaDb;
}

/** Conexão crua, para as transações SQL das invariantes 6 e 7. */
export function getSql() {
  getDb();
  return globalForDb.__mentoriaSql!;
}
