import "server-only";

/**
 * Segredos. `server-only` faz o build falhar se algum componente cliente
 * importar isto — é a barreira da invariante 5.
 */

/**
 * Chave secreta do Supabase — **ignora RLS**. Autentica como o papel Postgres
 * `service_role`, que é o nome usado nas invariantes. No painel aparece como
 * `secret`; `SUPABASE_SERVICE_ROLE_KEY` é o nome legado do mesmo segredo.
 */
export function requireSecretKey(): string {
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SECRET_KEY ausente. Veja `.env.local.example`.");
  }
  return key;
}

/** Conexão de runtime: pooler de transação (6543). */
export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL ausente. Veja `.env.local.example`.");
  }
  return url;
}

export const hasSecretKey = Boolean(
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
);
export const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
