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
 * As cores da família "marca" além do accent (F4b). Saem do accent por
 * `paletaDoAccent`, e a empresa pode ajustar qualquer uma. Ouro, sucesso e
 * erro ficam fora: significam a mesma coisa em todo cliente.
 */
export const CORES_DA_MARCA = [
  "ink",
  "mist",
  "white",
  "blush",
  "deep",
  "line",
  "line2",
  "stone",
  "stoneDark",
  "muted",
  "faint",
  "pale",
  "ghost",
] as const;

export type CorDaMarca = (typeof CORES_DA_MARCA)[number];

/** Ajuste fino: só as cores que a empresa escolheu à mão, diferentes da derivada. */
export type AjustesDeCor = Partial<Record<CorDaMarca, string>>;

export type Paleta = Record<CorDaMarca | "accent", string>;

/**
 * O que a empresa sobrescreve. Mora aqui, e não no módulo de configuração,
 * porque `normalizeHex` é daqui: se o tipo morasse lá, os dois módulos se
 * importariam em círculo por causa de uma validação de hex.
 */
export type Branding = {
  accent: string | null;
  name: string | null;
  logoUrl: string | null;
  /** Ausente é o mesmo que vazio: todas as cores derivadas do accent. */
  cores?: AjustesDeCor;
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
 * Branding resolvido → tema. A família "marca" sai do accent e recebe por
 * cima o ajuste fino da empresa; ouro e os tons de estado são estrutura do
 * sistema de design e não entram na personalização.
 */
export function resolveTheme(branding: Branding | null): Theme {
  const accent = normalizeHex(branding?.accent) ?? DEFAULT_THEME.accent;
  const paleta = paletaDoAccent(accent);
  for (const cor of CORES_DA_MARCA) {
    paleta[cor] = normalizeHex(branding?.cores?.[cor]) ?? paleta[cor];
  }
  return {
    ...DEFAULT_THEME,
    ...paleta,
    platformName: branding?.name?.trim() || DEFAULT_THEME.platformName,
    logoUrl: branding?.logoUrl?.trim() || null,
  };
}

type Hsl = { h: number; s: number; l: number };

function paraHsl(hex: string): Hsl {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

function deHsl({ h, s, l }: Hsl): string {
  const limitar = (v: number) => Math.max(0, Math.min(1, v));
  const [ss, ll] = [limitar(s), limitar(l)];
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const hh = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const [r, g, b] =
    hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
  const m = ll - c / 2;
  return `#${[r, g, b]
    .map((v) =>
      Math.round((v + m) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase()}`;
}

/**
 * A família "marca" inteira a partir de um accent só.
 *
 * Cada tom do padrão guarda a relação que tem com o magenta: o fundo é o
 * magenta quase branco, o texto é o magenta quase preto. Trocar o accent gira
 * todos os tons pela mesma diferença de matiz e acompanha a saturação dele,
 * sem mexer na luminosidade — então o fundo continua claro, o texto continua
 * escuro e o contraste do padrão sobrevive. Sem isso, uma marca verde ficava
 * com botão verde sobre fundo rosado. O `deep` acompanha a luminosidade do
 * accent, porque é a versão escura dele, não um tom fixo da página.
 *
 * O ganho de saturação tem teto (1,25×) para um accent berrante não tingir o
 * texto e as bordas além da conta; accent cinza dá neutros cinza.
 */
export function paletaDoAccent(accent: string): Paleta {
  const paleta = { accent } as Paleta;
  if (accent === DEFAULT_THEME.accent) {
    for (const cor of CORES_DA_MARCA) paleta[cor] = DEFAULT_THEME[cor];
    return paleta;
  }

  const ref = paraHsl(DEFAULT_THEME.accent);
  const nova = paraHsl(accent);
  const giro = nova.h - ref.h;
  const ganho = Math.min(nova.s / ref.s, 1.25);

  for (const cor of CORES_DA_MARCA) {
    const tom = paraHsl(DEFAULT_THEME[cor]);
    paleta[cor] =
      cor === "deep"
        ? deHsl({ h: nova.h + (tom.h - ref.h), s: nova.s * (tom.s / ref.s), l: nova.l * (tom.l / ref.l) })
        : deHsl({ h: tom.h + giro, s: tom.s * ganho, l: tom.l });
  }
  return paleta;
}

/**
 * O que guardar do ajuste fino: só cor válida e diferente da derivada, na
 * ordem de `CORES_DA_MARCA`. Guardar a derivada congelaria a cor — a empresa
 * que trocasse o accent depois ficaria com um fundo do accent antigo.
 */
export function ajustesDaMarca(accent: string, cores: Partial<Record<CorDaMarca, string | null>>): AjustesDeCor {
  const derivada = paletaDoAccent(accent);
  const ajustes: AjustesDeCor = {};
  for (const cor of CORES_DA_MARCA) {
    const valor = normalizeHex(cores[cor]);
    if (valor !== null && valor !== derivada[cor]) ajustes[cor] = valor;
  }
  return ajustes;
}

/** Razão de contraste da WCAG entre duas cores opacas: de 1 (igual) a 21 (preto e branco). */
export function contraste(a: string, b: string): number {
  const luminancia = (hex: string) => {
    const [r, g, b2] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
  };
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (escuro + 0.05);
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
