import "server-only";

/**
 * Segredos. `server-only` faz o build falhar se algum componente cliente
 * importar isto — é a barreira da invariante 5.
 */

/** Ignora RLS. Só em Route Handler e em `supabase/admin.ts`. */
export function requireServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ausente. Veja `.env.local.example`.",
    );
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

export const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
export const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
