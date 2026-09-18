import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { appConfig, orgs } from "@/lib/db/schema";
import { resolveTheme, type Branding, type Theme } from "@/lib/theme";
import type { Terms } from "@/lib/terms";
import {
  DEFAULT_APP_CONFIG,
  mergeBranding,
  parseAppConfig,
  parseBranding,
  type AppConfig,
} from "./app-config";

/**
 * Leitura de `app_config` e do branding da empresa.
 *
 * Vai por Drizzle, não pelo cliente do Supabase, por dois motivos: a
 * configuração é lida antes de haver sessão — a tela de entrada também tem
 * marca — e `app_config` é legível por qualquer autenticado de qualquer
 * forma, então não há escopo a proteger aqui. O branding da empresa é o único
 * recorte, e o `org_id` vem do JWT, nunca de parâmetro de rota.
 *
 * `cache()` é por requisição: o layout e cada página pedem a configuração e
 * o banco é consultado uma vez só.
 */

/**
 * Banco fora do ar não pode apagar a interface.
 *
 * `next build` roda sem `DATABASE_URL` e precisa passar; em produção, um
 * segundo de indisponibilidade do Postgres deve degradar o vocabulário para
 * o default, não devolver erro. O que depende de verdade do banco — saldo,
 * agenda, sessão — falha alto, como deve. Configuração, não.
 */
function onUnavailable<T>(what: string, fallback: T): (error: unknown) => T {
  return (error) => {
    console.warn(`[config] ${what} indisponível, usando o default:`, error);
    return fallback;
  };
}

export const loadAppConfig = cache(async (): Promise<AppConfig> => {
  try {
    const rows = await getDb()
      .select({ key: appConfig.key, value: appConfig.value })
      .from(appConfig);
    return parseAppConfig(rows);
  } catch (error) {
    return onUnavailable("app_config", DEFAULT_APP_CONFIG)(error);
  }
});

export const loadOrgBranding = cache(async (orgId: string): Promise<Branding | null> => {
  try {
    const [row] = await getDb()
      .select({ branding: orgs.branding })
      .from(orgs)
      .where(eq(orgs.id, orgId))
      .limit(1);
    return row ? parseBranding(row.branding) : null;
  } catch (error) {
    return onUnavailable(`branding da empresa ${orgId}`, null)(error);
  }
});

export async function loadTerms(): Promise<Terms> {
  return (await loadAppConfig()).terms;
}

/**
 * Tema da requisição: plataforma, com a empresa por cima quando há uma.
 *
 * Parceiro e operadora não pertencem a empresa nenhuma (invariante 9), então
 * veem sempre a marca da plataforma — é o comportamento certo para quem
 * atende várias empresas no mesmo dia.
 */
export async function loadTheme(orgId: string | null): Promise<Theme> {
  const config = await loadAppConfig();
  const org = orgId === null ? null : await loadOrgBranding(orgId);
  return resolveTheme(mergeBranding(config.branding, org));
}
