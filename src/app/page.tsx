'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth/auth-context';
import { HOME_BY_ROLE } from '@/lib/auth/roles';

/** Porta de entrada: manda cada papel para a sua area. */
export default function RootPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? HOME_BY_ROLE[role] : '/login');
  }, [loading, user, role, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-[#64748B]">
      Carregando...
    </div>
  );
}
