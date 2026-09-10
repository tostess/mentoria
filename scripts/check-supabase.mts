/**
 * Confere a fiação da Etapa 2 sem subir o Next.
 *
 *   npm run check:supabase
 *
 * Roda direto no Node 24 (type stripping nativo) e lê `.env.local`.
 * Não escreve nada em lugar nenhum.
 */

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const results: { label: string; ok: boolean; note: string }[] = [];

function record(label: string, ok: boolean, note: string) {
  results.push({ label, ok, note });
  console.log(`${ok ? "  ok  " : " FALHA"}  ${label}${note ? ` — ${note}` : ""}`);
}

function required(name: string): string | null {
  const value = process.env[name];
  if (!value) {
    record(name, false, "ausente no .env.local");
    return null;
  }
  record(name, true, "definida");
  return value;
}

console.log("\nVariáveis\n");

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
const databaseUrl = required("DATABASE_URL");
const directUrl = required("DIRECT_URL");

if (serviceKey && serviceKey === anonKey) {
  record("chaves distintas", false, "anon e service_role são iguais");
}

console.log("\nConexões\n");

if (url && anonKey) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.getUser();
  const ok = !error || error.name === "AuthSessionMissingError";
  record("Supabase Auth (anon)", ok, ok ? "responde" : (error?.message ?? ""));
}

for (const [label, connection] of [
  ["Postgres runtime (DATABASE_URL)", databaseUrl],
  ["Postgres migrations (DIRECT_URL)", directUrl],
] as const) {
  if (!connection) continue;
  const pooled = connection.includes("pgbouncer=true") || connection.includes(":6543");
  const sql = postgres(connection, { prepare: !pooled, max: 1, connect_timeout: 10 });
  try {
    const [row] = await sql<{ db: string; role: string }[]>`
      select current_database() as db, current_user as role
    `;
    record(label, true, `${row.db} como ${row.role}`);
  } catch (error) {
    record(label, false, error instanceof Error ? error.message : String(error));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

const failed = results.filter((r) => !r.ok);
console.log(
  failed.length === 0
    ? "\nTudo conectado.\n"
    : `\n${failed.length} verificação(ões) falharam.\n`,
);
process.exit(failed.length === 0 ? 0 : 1);
