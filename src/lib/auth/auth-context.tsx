'use client';

import { onIdTokenChanged, type User } from 'firebase/auth';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getFirebase } from '@/lib/firebase/client';
import { DEFAULT_ORG_ID, DEFAULT_ROLE, readClaims, type Role } from '@/lib/auth/roles';

interface AuthState {
  user: User | null;
  role: Role;
  orgId: string;
  loading: boolean;
  /** Forca refresh do ID token — usar depois de um callable mudar claims. */
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(DEFAULT_ROLE);
  const [orgId, setOrgId] = useState<string>(DEFAULT_ORG_ID);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { auth } = getFirebase();
    return onIdTokenChanged(auth, async (next) => {
      if (!next) {
        setUser(null);
        setRole(DEFAULT_ROLE);
        setOrgId(DEFAULT_ORG_ID);
        setLoading(false);
        return;
      }
      const token = await next.getIdTokenResult();
      const claims = readClaims(token.claims);
      setUser(next);
      setRole(claims.role);
      setOrgId(claims.orgId);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      role,
      orgId,
      loading,
      refreshClaims: async () => {
        const { auth } = getFirebase();
        if (!auth.currentUser) return;
        const token = await auth.currentUser.getIdTokenResult(true);
        const claims = readClaims(token.claims);
        setRole(claims.role);
        setOrgId(claims.orgId);
      },
    }),
    [user, role, orgId, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return ctx;
}
