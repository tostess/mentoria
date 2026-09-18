import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseClaims, type Role, type Session } from "./claims";
import { HOME_BY_ROLE } from "./routes";

/**
 * A sessão como o servidor a enxerga.
 *
 * `getClaims()` e não `getUser()`: `user_role` e `org_id` são claims
 * customizadas, escritas pelo hook do banco na emissão do token, e o objeto
 * de usuário do servidor de auth não as carrega. Além disso `getClaims()`
 * verifica a assinatura localmente quando o projeto usa chave assimétrica —
 * o cookie continua não sendo confiável, mas a verificação não custa uma
 * viagem de rede por requisição.
 *
 * `cache()` é por requisição: layout, página e ação leem a mesma sessão.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error !== null || !data) return null;
  return parseClaims(data.claims);
});

/** Página que exige alguém logado. Sem sessão utilizável, vai para a entrada. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (session === null) redirect("/entrar");
  return session;
}

/**
 * Página de um papel só. O `proxy.ts` já barrou antes, e isto repete a regra
 * dentro do layout de propósito: a rota pode mudar, o matcher pode ganhar uma
 * exceção, e a casca não deve depender disso para não abrir para quem não é.
 *
 * Nenhum dos dois é o que protege o dado — quem protege é a RLS.
 */
export async function requireRole(...roles: readonly Role[]): Promise<Session> {
  const session = await requireSession();
  if (!roles.includes(session.role)) redirect(HOME_BY_ROLE[session.role]);
  return session;
}
