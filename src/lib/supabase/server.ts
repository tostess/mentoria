import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireSupabasePublicEnv } from "@/lib/env";

/**
 * Cliente de servidor com a sessão do usuário, lida dos cookies. Continua na
 * chave anon: RLS vale, e é dela que saem `auth_role()` e `auth_org_id()`
 * (invariante 19 — papel e `org_id` vêm do JWT, nunca de campo de tabela).
 *
 * Um cliente novo por requisição, sempre. Nunca guardar em módulo.
 */
export async function createClient() {
  const { url, anonKey } = requireSupabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component não pode escrever cookie. Quem renova a sessão é
          // o `proxy.ts` (Etapa 4); aqui o silêncio é o comportamento correto.
        }
      },
    },
  });
}
