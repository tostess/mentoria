'use client';

import { httpsCallable } from 'firebase/functions';

import { getFirebase } from '@/lib/firebase/client';
import type { Role } from '@/lib/auth/roles';

interface BootstrapResult {
  role: Role;
  orgId: string;
  created: boolean;
}

/**
 * Chamado uma vez apos o login. O callable garante custom claims
 * (`role`/`orgId`) e o documento `users/{uid}` — o cliente nao cria nem um nem
 * outro por conta propria.
 */
export async function ensureUserBootstrap(): Promise<BootstrapResult> {
  const { functions } = getFirebase();
  const call = httpsCallable<void, BootstrapResult>(functions, 'ensureUserBootstrap');
  const { data } = await call();
  return data;
}
