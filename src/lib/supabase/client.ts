"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireSupabasePublicEnv } from "@/lib/env";

/**
 * Cliente do navegador. Carrega a chave anon, então **toda** leitura e escrita
 * passa por RLS. É o único cliente que pode existir fora do servidor.
 *
 * O que ele nunca escreve (invariante 4): `bookings`, `wallets`,
 * `wallet_ledger`, `org_wallets`, `org_ledger`. Não há policy para isso —
 * a tentativa falha no banco, não no código.
 */
export function createClient() {
  const { url, anonKey } = requireSupabasePublicEnv();
  return createBrowserClient(url, anonKey);
}
