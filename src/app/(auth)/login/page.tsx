'use client';

import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-context';
import { ensureUserBootstrap } from '@/lib/auth/bootstrap';
import { HOME_BY_ROLE } from '@/lib/auth/roles';
import { getFirebase } from '@/lib/firebase/client';
import { DEFAULT_APP_CONFIG } from '@/lib/config/defaults';

const b = DEFAULT_APP_CONFIG.branding;

/**
 * Login minimo do scaffold. Onboarding, escolha de fuso e perfil entram na F1.
 * Mentor nao aparece aqui: so existe mentor vindo de convite (invariante 7).
 */
export default function LoginPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) router.replace(HOME_BY_ROLE[role]);
  }, [loading, user, role, router]);

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    try {
      const { auth } = getFirebase();
      await signInWithPopup(auth, new GoogleAuthProvider());
      // Garante claims (role/orgId) e o documento users/{uid} no servidor.
      await ensureUserBootstrap();
      const token = await auth.currentUser?.getIdTokenResult(true);
      const nextRole = (token?.claims.role as keyof typeof HOME_BY_ROLE) ?? 'mentee';
      router.replace(HOME_BY_ROLE[nextRole]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao entrar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div
        className="w-full max-w-sm rounded-2xl border p-8"
        style={{ backgroundColor: b.surface, borderColor: b.border }}
      >
        <h1 className="text-xl font-semibold" style={{ color: b.text }}>
          {b.productName}
        </h1>
        <p className="mt-1 text-sm" style={{ color: b.textMuted }}>
          {DEFAULT_APP_CONFIG.copy.tagline}
        </p>

        <Button className="mt-6 w-full" onClick={handleGoogle} disabled={busy}>
          {busy ? 'Entrando...' : 'Entrar com Google'}
        </Button>

        {error ? (
          <p className="mt-3 text-xs" style={{ color: b.danger }}>
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
