/**
 * Tema resolvido da plataforma.
 *
 * O produto é white-label. O magenta abaixo é só o default da plataforma, e
 * nenhum componente escreve cor como literal: a cor chega à tela como token do
 * Tailwind (`bg-accent`, `text-stone`), que lê as variáveis `--cor-*` que o
 * layout raiz põe em `<html>` com `variaveisDoTema()`. `useTheme()` fica para
 * quem precisa do valor em JS — o nome e o logotipo.
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
  /** Neutros de apoio, do mais escuro ao mais claro: texto de etiqueta, rótulo da marca, ícone apagado. */
  stoneDark: string;
  muted: string;
  faint: string;
  pale: string;
  ghost: string;
  gold: string;
  goldSoft: string;
  goldInk: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  /** Nome exibido na marca. Vem de `branding.name`; o default é placeholder. */
  platformName: string;
  logoUrl: string | null;
};

/**
 * O que a empresa sobrescreve. Mora aqui, e não no módulo de configuração,
 * porque `normalizeHex` é daqui: se o tipo morasse lá, os dois módulos se
 * importariam em círculo por causa de uma validação de hex.
 */
export type Branding = {
  accent: string | null;
  name: string | null;
  logoUrl: string | null;
};

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
  stoneDark: "#6E5F68",
  muted: "#B3A3AC",
  faint: "#BFAFB8",
  pale: "#C6B8C0",
  ghost: "#D9C3CF",
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

/**
 * Branding resolvido → tema. Só `accent`, nome e logotipo mudam por empresa:
 * ink, ouro e os tons de estado são estrutura do sistema de design e não
 * entram na personalização.
 */
export function resolveTheme(branding: Branding | null): Theme {
  return {
    ...DEFAULT_THEME,
    accent: normalizeHex(branding?.accent) ?? DEFAULT_THEME.accent,
    platformName: branding?.name?.trim() || DEFAULT_THEME.platformName,
    logoUrl: branding?.logoUrl?.trim() || null,
  };
}

/**
 * O tom de borda que acompanha o accent. O default é o tom escolhido à mão no
 * protótipo; para outra marca, o accent sobre branco a 38%, que reproduz o
 * default com menos de 2 pontos de diferença por canal.
 */
export function accentLine(accent: string): string {
  if (accent === DEFAULT_THEME.accent) return "#E7B3CC";
  return misturar(accent, "#FFFFFF", 0.38);
}

/** `cor` sobre `fundo` com opacidade `peso`, já resolvida em hex opaco. */
export function misturar(cor: string, fundo: string, peso: number): string {
  const canal = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const p = Math.max(0, Math.min(1, peso));
  const partes = [0, 1, 2].map((i) =>
    Math.round(canal(cor, i) * p + canal(fundo, i) * (1 - p))
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${partes.join("").toUpperCase()}`;
}

/**
 * As variáveis `--cor-*` da marca, para `<html style>` (ou para o `div` de uma
 * prévia, ou da entrada com a marca da empresa). Os tons fixos — ouro,
 * sucesso, erro — não entram: moram só em `globals.css`.
 *
 * Os derivados do accent saem calculados aqui, e não pelo `color-mix` do
 * Tailwind (`bg-accent/10`): é o mesmo `withAlpha` de sempre, então o tema
 * padrão continua igual pixel a pixel.
 */
export function variaveisDoTema(theme: Theme): Record<`--cor-${string}`, string> {
  return {
    "--cor-ink": theme.ink,
    "--cor-mist": theme.mist,
    "--cor-surface": theme.white,
    "--cor-blush": theme.blush,
    "--cor-accent": theme.accent,
    "--cor-accent-10": withAlpha(theme.accent, 0.1),
    "--cor-accent-12": withAlpha(theme.accent, 0.12),
    "--cor-accent-line": accentLine(theme.accent),
    "--cor-on-accent": onAccent(theme.accent),
    "--cor-on-soft": onSoft(theme.accent),
    "--cor-deep": theme.deep,
    "--cor-line": theme.line,
    "--cor-line2": theme.line2,
    "--cor-stone": theme.stone,
    "--cor-stone-dark": theme.stoneDark,
    "--cor-muted": theme.muted,
    "--cor-faint": theme.faint,
    "--cor-pale": theme.pale,
    "--cor-ghost": theme.ghost,
  };
}
