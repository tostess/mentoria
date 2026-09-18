/**
 * Vocabulário de domínio. Nenhum termo é escrito direto na interface — tudo
 * passa por aqui, e o conteúdo vem de `app_config.copy.terms`, sobrescrevível
 * por empresa.
 *
 * O nome da plataforma **não** mora aqui: é marca, não vocabulário, e vive em
 * `branding` — o mesmo lugar de onde a empresa sobrescreve accent e logotipo.
 *
 * Não existe export de um objeto de termos pronto. Se existisse, seria o
 * caminho mais curto para um "Parceiro" congelado no bundle, e a promessa de
 * white-label morreria por conveniência. Quem precisa de termos resolvidos
 * chama `loadTerms()` no servidor ou `useTerms()` no cliente.
 */

export type Terms = {
  partner: string;
  partnerLong: string;
  partners: string;
  professional: string;
  professionals: string;
  ficha: string;
  fichas: string;
  org: string;
  orgs: string;
  orgAdmin: string;
  admin: string;
  moderator: string;
  session: string;
  sessions: string;
};

export const DEFAULT_TERMS: Terms = {
  partner: "Parceiro",
  partnerLong: "Parceiro de Desenvolvimento",
  partners: "Parceiros",
  professional: "Profissional",
  professionals: "Profissionais",
  ficha: "ficha",
  fichas: "fichas",
  org: "Empresa",
  orgs: "Empresas",
  orgAdmin: "RH",
  admin: "Operadora",
  moderator: "Moderação",
  session: "sessão",
  sessions: "sessões",
};

const TERM_KEYS = Object.keys(DEFAULT_TERMS) as (keyof Terms)[];

/**
 * Sobrescritas do banco por cima do default. Só chave conhecida e só texto
 * não vazio: `app_config` é jsonb, e uma chave a mais ou um `null` no lugar
 * de um termo não pode derrubar a interface inteira.
 */
export function resolveTerms(overrides: unknown): Terms {
  if (typeof overrides !== "object" || overrides === null) return DEFAULT_TERMS;
  const source = overrides as Record<string, unknown>;

  const resolved = { ...DEFAULT_TERMS };
  for (const key of TERM_KEYS) {
    const value = source[key];
    if (typeof value === "string" && value.trim() !== "") resolved[key] = value.trim();
  }
  return resolved;
}

/** "1 ficha", "3 fichas" — sempre com o termo configurado. */
export function countFichas(n: number, t: Terms): string {
  return `${n} ${n === 1 ? t.ficha : t.fichas}`;
}

export function countSessions(n: number, t: Terms): string {
  return `${n} ${n === 1 ? t.session : t.sessions}`;
}

/** Primeira letra maiúscula, para começo de frase: "Fichas disponíveis". */
export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
