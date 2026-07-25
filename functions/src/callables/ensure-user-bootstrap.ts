import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';

import { auth, db } from '../lib/admin';
import { DEFAULT_ORG_ID, DEFAULT_ROLE, readClaims } from '../lib/roles';

/**
 * Primeiro acesso: garante custom claims (`role`, `orgId`) e o documento
 * `users/{uid}`.
 *
 * O cliente nunca escreve `role` nem `orgId` — quem entra sozinho vira `mentee`
 * na org `'public'` (invariantes 7 e 9). Idempotente: se as claims ja existem,
 * so devolve o estado atual.
 */
export const ensureUserBootstrap = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Faca login para continuar.');
  }

  const existing = readClaims(request.auth?.token as Record<string, unknown> | undefined);
  const hadClaims =
    typeof request.auth?.token?.role === 'string' && typeof request.auth?.token?.orgId === 'string';

  const role = hadClaims ? existing.role : DEFAULT_ROLE;
  const orgId = hadClaims ? existing.orgId : DEFAULT_ORG_ID;

  if (!hadClaims) {
    await auth.setCustomUserClaims(uid, { role, orgId });
  }

  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();

  if (!snap.exists) {
    const record = await auth.getUser(uid);
    await userRef.set({
      uid,
      orgId,
      role,
      name: record.displayName ?? '',
      email: record.email ?? '',
      photoURL: record.photoURL ?? null,
      // Fuso do usuario: a UI corrige no onboarding (F1). Banco sempre em UTC.
      timezone: 'America/Sao_Paulo',
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  return { role, orgId, created: !snap.exists };
});
