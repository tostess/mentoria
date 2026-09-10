import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireSupabasePublicEnv } from "@/lib/env";
import { requireSecretKey } from "@/lib/env.server";

/**
 * Cliente `service_role` — **ignora RLS**. Autenticado pela chave secreta.
 *
 * Invariante 5: só existe aqui e em Route Handlers. Nunca em componente
 * cliente, nunca em variável `NEXT_PUBLIC_`. `server-only` garante isso no
 * build; a revisão garante o resto.
 *
 * É por aqui que passa toda escrita privilegiada (invariante 4): reserva,
 * alocação, estorno, presente. Sem sessão e sem persistência — este cliente
 * não é de ninguém.
 */
export function createAdminClient() {
  const { url } = requireSupabasePublicEnv();
  return createSupabaseClient(url, requireSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
