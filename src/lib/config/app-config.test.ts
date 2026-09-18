import { describe, expect, it } from "vitest";
import {
  DEFAULT_APP_CONFIG,
  mergeBranding,
  parseAppConfig,
  parseBranding,
  type ConfigRow,
} from "./app-config";
import { DEFAULT_TERMS } from "@/lib/terms";
import { DEFAULT_THEME, resolveTheme } from "@/lib/theme";

/**
 * `app_config` é jsonb: o Postgres garante que é JSON válido e mais nada. O
 * formato é responsabilidade desta camada, e o critério é que uma linha
 * estragada degrade para o default em vez de apagar a tela.
 */

describe("parseAppConfig", () => {
  it("banco vazio devolve os defaults", () => {
    expect(parseAppConfig([])).toEqual(DEFAULT_APP_CONFIG);
  });

  it("lê a política da ficha como a migração a semeia", () => {
    const rows: ConfigRow[] = [
      {
        key: "ficha_policy",
        value: {
          default_allocation_per_user: 2,
          expires: false,
          max_balance: 6,
          price_30: 1,
          cancel_window_hours: 12,
          partner_no_show_bonus: 1,
          gift_quota_monthly: 3,
          extension_quota_monthly: 3,
          idle_nudge_after_days: 21,
        },
      },
      {
        key: "limits",
        value: {
          booking_horizon_days: 14,
          max_pending_per_professional: 2,
          pending_expires_hours: 48,
          min_notice_hours: 12,
          session_grace_minutes: 15,
        },
      },
      { key: "flags", value: { partner_earns_fichas: false } },
    ];

    const config = parseAppConfig(rows);
    expect(config.fichaPolicy).toEqual(DEFAULT_APP_CONFIG.fichaPolicy);
    expect(config.limits).toEqual(DEFAULT_APP_CONFIG.limits);
    expect(config.flags).toEqual(DEFAULT_APP_CONFIG.flags);
  });

  it("aceita valor mudado e ignora chave desconhecida", () => {
    const config = parseAppConfig([
      { key: "ficha_policy", value: { max_balance: 10, chave_do_futuro: "?" } },
    ]);
    expect(config.fichaPolicy.maxBalance).toBe(10);
    expect(config.fichaPolicy.price30).toBe(DEFAULT_APP_CONFIG.fichaPolicy.price30);
  });

  it("valor do tipo errado cai no default em vez de virar NaN na tela", () => {
    const config = parseAppConfig([
      { key: "ficha_policy", value: { max_balance: "seis", price_30: 1.5, expires: "sim" } },
      { key: "limits", value: "nada disso" },
    ]);
    expect(config.fichaPolicy.maxBalance).toBe(6);
    expect(config.fichaPolicy.price30).toBe(1);
    expect(config.fichaPolicy.expires).toBe(false);
    expect(config.limits).toEqual(DEFAULT_APP_CONFIG.limits);
  });

  it("sobrescreve só o termo informado", () => {
    const config = parseAppConfig([
      { key: "copy", value: { terms: { partner: "Mentor", fichas: "créditos" } } },
    ]);
    expect(config.terms.partner).toBe("Mentor");
    expect(config.terms.fichas).toBe("créditos");
    expect(config.terms.professional).toBe(DEFAULT_TERMS.professional);
  });

  it("termo vazio ou nulo não apaga o default", () => {
    const config = parseAppConfig([
      { key: "copy", value: { terms: { partner: "   ", professional: null, ficha: 7 } } },
    ]);
    expect(config.terms).toEqual(DEFAULT_TERMS);
  });
});

describe("branding", () => {
  it("normaliza o accent e recusa hex inválido", () => {
    expect(parseBranding({ accent: "c2317a" }).accent).toBe("#C2317A");
    expect(parseBranding({ accent: "#abc" }).accent).toBe("#AABBCC");
    expect(parseBranding({ accent: "magenta" }).accent).toBeNull();
  });

  /**
   * O accent vai para `style` inline. Um hex quebrado não daria erro nenhum —
   * apagaria o contraste do item ativo da navegação em silêncio.
   */
  it("accent inválido cai no accent da plataforma", () => {
    expect(resolveTheme(parseBranding({ accent: "rosa" })).accent).toBe(DEFAULT_THEME.accent);
  });

  it("a empresa sobrescreve campo a campo", () => {
    const plataforma = parseBranding({ accent: "#C2317A" });
    const empresa = parseBranding({ logo_url: "https://cdn.exemplo/logo.png" });
    const merged = mergeBranding(plataforma, empresa);

    expect(merged.accent).toBe("#C2317A");
    expect(merged.logoUrl).toBe("https://cdn.exemplo/logo.png");
  });

  it("sem empresa, vale a plataforma", () => {
    const plataforma = parseBranding({ accent: "#1F4E9C", name: "Plataforma" });
    expect(mergeBranding(plataforma, null)).toEqual(plataforma);
  });

  it("empresa com accent próprio ganha da plataforma", () => {
    const merged = mergeBranding(parseBranding({ accent: "#C2317A" }), parseBranding({ accent: "#1B7F6B" }));
    expect(resolveTheme(merged).accent).toBe("#1B7F6B");
  });
});
