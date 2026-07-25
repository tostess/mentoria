import { DEFAULT_ORG_ID } from '@/lib/auth/roles';

/**
 * INVARIANTE 9: `orgId` em todo documento com escopo, default `'public'`, e
 * nunca consultar colecao com escopo sem filtrar por `orgId`.
 *
 * Helpers pequenos e propositais: quem esquecer o escopo quebra no type-check
 * em vez de vazar dado entre orgs.
 */

export interface Scoped {
  orgId: string;
}

/** Carimba `orgId` num documento novo. Sem argumento, nasce na org publica. */
export function withOrgScope<T extends object>(data: T, orgId: string = DEFAULT_ORG_ID): T & Scoped {
  return { ...data, orgId };
}

/** Colecoes cujo acesso exige filtro por `orgId`. */
export const SCOPED_COLLECTIONS = [
  'users',
  'mentors',
  'mentorInvites',
  'mentorApplications',
  'bookings',
  'briefings',
  'wallets',
  'goals',
  'asyncQuestions',
  'tracks',
  'mentorRequests',
  'reports',
  'moderationQueue',
  'auditLogs',
] as const;

export type ScopedCollection = (typeof SCOPED_COLLECTIONS)[number];

export function isScopedCollection(name: string): name is ScopedCollection {
  return (SCOPED_COLLECTIONS as readonly string[]).includes(name);
}

/**
 * Guarda de leitura: falha alto se um documento com escopo vier de outra org.
 * Usar depois de qualquer `get()` por ID (onde o filtro de query nao protege).
 */
export function assertSameOrg(doc: Partial<Scoped> | undefined | null, orgId: string): void {
  if (!doc || doc.orgId !== orgId) {
    throw new Error(`Documento fora do escopo da org "${orgId}".`);
  }
}
