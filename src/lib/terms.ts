/**
 * Vocabulário de domínio. Nenhum termo de domínio é escrito direto na UI —
 * tudo passa por aqui. Na Etapa 4 este módulo passa a ler `app_config.copy.terms`,
 * com sobrescrita por empresa.
 */

export type Terms = {
  /** Nome exibido da plataforma. Em aberto — placeholder até app_config. */
  platformName: string;
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
  platformName: "Mentoria",
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

export const terms: Terms = DEFAULT_TERMS;

/** "1 ficha", "3 fichas" — sempre com o termo configurado. */
export function countFichas(n: number, t: Terms = terms): string {
  return `${n} ${n === 1 ? t.ficha : t.fichas}`;
}

export function countSessions(n: number, t: Terms = terms): string {
  return `${n} ${n === 1 ? t.session : t.sessions}`;
}

/** Primeira letra maiúscula, para começo de frase: "Fichas disponíveis". */
export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
