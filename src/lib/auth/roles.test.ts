import { describe, expect, it } from 'vitest';

import { DEFAULT_ORG_ID, hasRole, isStaff, readClaims, ROLES } from './roles';

describe('papeis', () => {
  it('tem exatamente os quatro papeis do CLAUDE.md', () => {
    expect([...ROLES]).toEqual(['mentee', 'mentor', 'moderator', 'admin']);
  });

  it('trata staff como admin ou moderador', () => {
    expect(isStaff('admin')).toBe(true);
    expect(isStaff('moderator')).toBe(true);
    expect(isStaff('mentor')).toBe(false);
    expect(isStaff('mentee')).toBe(false);
  });

  it('nao concede papel por hierarquia implicita', () => {
    expect(hasRole('moderator', ['admin'])).toBe(false);
    expect(hasRole('admin', ['admin', 'moderator'])).toBe(true);
  });
});

describe('readClaims', () => {
  it('sem claims, cai em mentee na org publica', () => {
    expect(readClaims(undefined)).toEqual({ role: 'mentee', orgId: DEFAULT_ORG_ID });
    expect(readClaims({})).toEqual({ role: 'mentee', orgId: DEFAULT_ORG_ID });
  });

  it('ignora papel invalido em vez de confiar nele', () => {
    expect(readClaims({ role: 'superadmin', orgId: 'acme' })).toEqual({
      role: 'mentee',
      orgId: 'acme',
    });
  });

  it('preserva claims validas', () => {
    expect(readClaims({ role: 'admin', orgId: 'acme' })).toEqual({ role: 'admin', orgId: 'acme' });
  });
});
