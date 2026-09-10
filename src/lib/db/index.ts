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
