'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { useAuth } from '@/lib/auth/auth-context';
import { HOME_BY_ROLE, hasRole, type Role } from '@/lib/auth/roles';

/**
 * Guarda de rota por papel, usada nos layouts dos grupos (mentee), (mentor) e
 * (admin). E conveniencia de navegacao, nao seguranca: quem manda sao as
 * Security Rules e a checagem de claims dentro de cada callable.
 */
export function RoleGate({ allow, children }: { allow: readonly Role[]; children: ReactNode }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!hasRole(role, allow)) {
      router.replace(HOME_BY_ROLE[role]);
    }
  }, [loading, user, role, allow, router]);

  if (loading || !user || !hasRole(role, allow)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[#64748B]">
        Carregando...
      </div>
    );
  }

  return <>{children}</>;
}
