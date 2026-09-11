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

/** Aceita o nome novo do painel ou o legado do mesmo papel. */
function required(...names: string[]): string | null {
  const hit = names.find((name) => process.env[name]);
  if (!hit) {
    record(names[0], false, "ausente no .env.local");
    return null;
  }
  const value = process.env[hit]!;
  if (/SEU_PROJECT_REF|SENHA|YOUR-PASSWORD/.test(value)) {
    record(hit, false, "ainda com o texto do template");
    return null;
  }
  record(hit, true, hit === names[0] ? "definida" : "definida (nome legado)");
  return value;
}

console.log("\nVariáveis\n");

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const publishableKey = required(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
);
const secretKey = required("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
const databaseUrl = required("DATABASE_URL");
const directUrl = required("DIRECT_URL");

if (secretKey && secretKey === publishableKey) {
  record("chaves distintas", false, "a pública e a secreta são iguais");
}
/** Chave de API do Supabase: `sb_secret_...`/`sb_publishable_...` ou um JWT. */
function looksLikeApiKey(value: string) {
  return /^sb_(secret|publishable)_/.test(value) || value.startsWith("eyJ");
}

if (secretKey && !looksLikeApiKey(secretKey)) {
  record(
    "formato da chave secreta",
    false,
    "não parece chave de API (esperado `sb_secret_...`) — senha do banco colada aqui?",
  );
} else if (secretKey?.startsWith("sb_publishable_")) {
  record("formato da chave secreta", false, "é a publishable, não a secret");
}
if (publishableKey && !looksLikeApiKey(publishableKey)) {
  record("formato da chave pública", false, "não parece chave de API");
}

console.log("\nConexões\n");

if (url && publishableKey) {
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.getUser();
  const ok = !error || error.name === "AuthSessionMissingError";
  record("Supabase Auth (publishable)", ok, ok ? "responde" : (error?.message ?? ""));
}

if (url && secretKey) {
  // `listUsers` exige a chave secreta: com a publishable o Supabase responde
  // 401. É a prova de que a chave que ignora RLS é válida mesmo.
  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.auth.admin.listUsers({ perPage: 1 });
  record("Supabase Admin (secret)", !error, error ? error.message : "responde");
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
// `process.exit()` derruba o libuv no Windows enquanto os sockets do Supabase
// ainda fecham. Marcar o código deixa o Node sair sozinho.
process.exitCode = failed.length === 0 ? 0 : 1;
