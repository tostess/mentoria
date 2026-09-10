/**
 * Tema resolvido da plataforma.
 *
 * O produto é white-label: só o `accent` (e o logotipo) mudam por empresa.
 * O magenta abaixo é apenas o default da plataforma. Nenhum componente deve
 * escrever o accent como literal — sempre ler de `useTheme()` ou receber por prop.
 */

export type Theme = {
  ink: string;
  mist: string;
  white: string;
  blush: string;
  accent: string;
  deep: string;
  line: string;
  line2: string;
  stone: string;
  gold: string;
  goldSoft: string;
  goldInk: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  /** Nome exibido na marca. Placeholder até vir de app_config. */
  platformName: string;
  logoUrl: string | null;
};

/** Recorte mínimo de `app_config` que o tema precisa. Cresce na Etapa 4. */
export type ThemeConfig = {
  branding?: {
    accent?: string | null;
    name?: string | null;
    logoUrl?: string | null;
  } | null;
} | null;

export const DEFAULT_THEME: Theme = {
  ink: "#2A1B26",
  mist: "#FDF8FB",
  white: "#FFFFFF",
  blush: "#FCEDF4",
  accent: "#C2317A",
  deep: "#8E1E58",
  line: "#F3E4EC",
  line2: "#EAD6E1",
  stone: "#8E7C86",
  gold: "#C98A2E",
  goldSoft: "#FBF1DE",
  goldInk: "#7A5209",
  success: "#2E6B52",
  successSoft: "#EAF6F0",
  danger: "#A63A2E",
  dangerSoft: "#FBEAE7",
  platformName: "Mentoria",
  logoUrl: null,
};

const HEX6 = /^#?([0-9a-f]{6})$/i;
const HEX3 = /^#?([0-9a-f]{3})$/i;

/** Normaliza para `#RRGGBB` maiúsculo; devolve null se não for hex válido. */
export function normalizeHex(input: string | null | undefined): string | null {
  if (!input) return null;
  const value = input.trim();
  const six = HEX6.exec(value);
  if (six) return `#${six[1].toUpperCase()}`;
  const three = HEX3.exec(value);
  if (three) {
    const [r, g, b] = three[1].split("");
    return `#${(r + r + g + g + b + b).toUpperCase()}`;
  }
  return null;
}

/** Hex de 6 dígitos + alpha (0–1) → hex de 8 dígitos. Usado para fundos suaves do accent. */
export function withAlpha(hex: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const a = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `${hex}${a}`;
}

/** Cor de texto legível sobre o accent: branco ou ink, por luminância. */
export function onAccent(hex: string): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? DEFAULT_THEME.ink : DEFAULT_THEME.white;
}

/**
 * Cor de texto sobre um fundo suave do accent (accent com alpha baixo):
 * o próprio accent se for escuro o bastante, senão ink.
 */
export function onSoft(hex: string): string {
  return onAccent(hex) === DEFAULT_THEME.white ? hex : DEFAULT_THEME.ink;
}

export function resolveTheme(config: ThemeConfig): Theme {
  const branding = config?.branding ?? null;
  const accent = normalizeHex(branding?.accent) ?? DEFAULT_THEME.accent;
  const platformName = branding?.name?.trim() || DEFAULT_THEME.platformName;
  const logoUrl = branding?.logoUrl?.trim() || null;
  return { ...DEFAULT_THEME, accent, platformName, logoUrl };
}
