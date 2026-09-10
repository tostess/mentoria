/**
 * Variáveis públicas. Este módulo pode ser importado do navegador — só entra
 * aqui o que já vai no bundle. Segredo mora em `env.server.ts`.
 *
 * O Next substitui `process.env.NEXT_PUBLIC_X` em tempo de build apenas quando
 * escrito assim, literal. Nada de acesso indexado.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Falso quando o `.env.local` ainda não foi preenchido. */
export const hasSupabasePublicEnv = SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";

/**
 * Lê as duas públicas ou explode. Chamado no ponto de uso, nunca no topo do
 * módulo: `next build` roda sem `.env.local` e não pode quebrar por isso.
 */
export function requireSupabasePublicEnv(): { url: string; anonKey: string } {
  if (!hasSupabasePublicEnv) {
    throw new Error(
      "Supabase não configurado: defina NEXT_PUBLIC_SUPABASE_URL e " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY. Veja `.env.local.example`.",
    );
  }
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
}
