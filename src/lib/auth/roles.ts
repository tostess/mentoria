/**
 * Papeis da plataforma. Vivem como custom claims no token do Firebase Auth e
 * sao espelhados em `users/{uid}.role` apenas para leitura de UI.
 *
 * CLAUDE.md: `admin` cuida de curadoria, economia e personalizacao;
 * `moderator` cuida de fila, denuncias e estornos — nao mexe em aparencia nem
 * em regras da moeda.
 */
export const ROLES = ['mentee', 'mentor', 'moderator', 'admin'] as const;

export type Role = (typeof ROLES)[number];

/** Org padrao do marketplace aberto (invariante 9). */
export const DEFAULT_ORG_ID = 'public';

/** Papel de quem acabou de se cadastrar. Mentor nunca nasce daqui (invariante 7). */
export const DEFAULT_ROLE: Role = 'mentee';

/** Custom claims que a plataforma escreve no token. */
export interface AppClaims {
  role: Role;
  orgId: string;
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/**
 * Le claims de um token ja decodificado, com fallback seguro: quem nao tem
 * claim e tratado como mentee da org publica, nunca como staff.
 */
export function readClaims(raw: Record<string, unknown> | undefined | null): AppClaims {
  const role = isRole(raw?.role) ? raw.role : DEFAULT_ROLE;
  const orgId = typeof raw?.orgId === 'string' && raw.orgId ? raw.orgId : DEFAULT_ORG_ID;
  return { role, orgId };
}

export function isStaff(role: Role): boolean {
  return role === 'admin' || role === 'moderator';
}

/** Um papel atende a exigencia se estiver na lista permitida. Sem hierarquia implicita. */
export function hasRole(role: Role, allowed: readonly Role[]): boolean {
  return allowed.includes(role);
}

/** Rota inicial de cada papel — usada no pos-login e nos guards de grupo. */
export const HOME_BY_ROLE: Record<Role, string> = {
  mentee: '/inicio',
  mentor: '/mentor',
  moderator: '/admin',
  admin: '/admin',
};
