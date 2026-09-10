import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { hasSupabasePublicEnv } from "@/lib/env";
import { hasDatabaseUrl, hasSecretKey } from "@/lib/env.server";

/**
 * Diagnóstico da Etapa 2: o app enxerga o Supabase e o Postgres?
 *
 * Devolve só booleanos e tempo. Fora de desenvolvimento não vaza mensagem de
 * erro — o motivo da falha fica no log do servidor.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Check = { ok: boolean; ms: number; detail?: string };

const isDev = process.env.NODE_ENV !== "production";

async function timed(run: () => Promise<void>): Promise<Check> {
  const started = Date.now();
  try {
    await run();
    return { ok: true, ms: Date.now() - started };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[health]", message);
    return {
      ok: false,
      ms: Date.now() - started,
      ...(isDev ? { detail: message } : {}),
    };
  }
}

export async function GET() {
  const env = {
    supabaseUrl: hasSupabasePublicEnv,
    secretKey: hasSecretKey,
    databaseUrl: hasDatabaseUrl,
  };

  const [database, supabase] = await Promise.all([
    timed(async () => {
      await getDb().execute(sql`select 1`);
    }),
    timed(async () => {
      const client = await createClient();
      // Sem sessão a resposta é `user: null` — o que importa é não ter erro
      // de rede nem de chave.
      const { error } = await client.auth.getUser();
      if (error && error.name !== "AuthSessionMissingError") throw error;
    }),
  ]);

  const ok = Object.values(env).every(Boolean) && database.ok && supabase.ok;

  return Response.json(
    { ok, env, database, supabase, at: new Date().toISOString() },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
