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

/**
 * Segredo que autentica o trabalho agendado. A Vercel manda
 * `Authorization: Bearer $CRON_SECRET` quando a variável existe, e é por isso
 * que ela tem esse nome exato.
 *
 * Sem o segredo configurado, os endpoints de cron **fecham** em vez de abrir: um
 * deploy com variável faltando não pode virar uma porta pela qual qualquer um
 * recarrega a carteira de todo mundo. Mesma escolha do `proxy.ts` quando falta
 * variável do Supabase.
 */
export function requireCronSecret(): string {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    throw new Error("CRON_SECRET ausente. Veja `.env.local.example`.");
  }
  return segredo;
}

/**
 * Chave da REST API do Daily. Um domínio por ambiente (invariante 17 estendida
 * ao vídeo): em Preview e Development é o domínio de teste; Production só ganha
 * a sua quando existir domínio próprio. Até lá, produção não tem vídeo — e a
 * sala diz isso em vez de estourar, porque `hasDailyApiKey` é conferido antes.
 */
export function requireDailyApiKey(): string {
  const chave = process.env.DAILY_API_KEY;
  if (!chave) {
    throw new Error("DAILY_API_KEY ausente. Veja `.env.local.example`.");
  }
  return chave;
}

export const hasSecretKey = Boolean(
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
);
export const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
export const hasCronSecret = Boolean(process.env.CRON_SECRET);
export const hasDailyApiKey = Boolean(process.env.DAILY_API_KEY);
