/**
 * Copia proposital de `src/lib/auth/roles.ts`.
 *
 * `functions/` e um pacote npm separado, com seu proprio tsconfig e deploy —
 * nao importa do app Next. Ao mudar papeis, mudar nos dois lugares.
 */
export const ROLES = ['mentee', 'mentor', 'moderator', 'admin'] as const;

export type Role = (typeof ROLES)[number];

export const DEFAULT_ORG_ID = 'public';
export const DEFAULT_ROLE: Role = 'mentee';

export interface AppClaims {
  role: Role;
  orgId: string;
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function readClaims(raw: Record<string, unknown> | undefined | null): AppClaims {
  const role = isRole(raw?.role) ? raw.role : DEFAULT_ROLE;
  const orgId = typeof raw?.orgId === 'string' && raw.orgId ? raw.orgId : DEFAULT_ORG_ID;
  return { role, orgId };
}
