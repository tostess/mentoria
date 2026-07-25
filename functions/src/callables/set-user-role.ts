import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { auth, db } from '../lib/admin';
import { writeAuditLog } from '../lib/audit';
import { isRole, readClaims, type Role } from '../lib/roles';

/**
 * Troca o papel de um usuario. So `admin` chama, e toda chamada gera auditLog
 * (invariante 11).
 *
 * `mentor` NAO sai daqui: mentor so existe vindo de `mentorInvites`
 * (invariante 7). A promocao a mentor entra na F1.5, junto com o convite.
 */
const ASSIGNABLE: readonly Role[] = ['mentee', 'moderator', 'admin'];

export const setUserRole = onCall<{ uid: string; role: string; orgId?: string }>(
  async (request) => {
    const caller = request.auth;
    if (!caller) {
      throw new HttpsError('unauthenticated', 'Faca login para continuar.');
    }

    const callerClaims = readClaims(caller.token as unknown as Record<string, unknown>);
    if (callerClaims.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Apenas admin muda papel.');
    }

    const { uid, role, orgId } = request.data ?? {};
    if (!uid || !isRole(role)) {
      throw new HttpsError('invalid-argument', 'Informe `uid` e um `role` valido.');
    }
    if (!ASSIGNABLE.includes(role)) {
      throw new HttpsError(
        'failed-precondition',
        'Mentor so existe vindo de convite (mentorInvites).',
      );
    }

    const target = await auth.getUser(uid);
    const before = readClaims(target.customClaims as Record<string, unknown> | undefined);
    const after = { role, orgId: orgId ?? before.orgId };

    await auth.setCustomUserClaims(uid, after);
    await db.collection('users').doc(uid).set(after, { merge: true });
    // O token antigo continua valido ate expirar; o cliente deve chamar
    // getIdToken(true) — ou aguardar ate 1h — para ver o papel novo.
    await auth.revokeRefreshTokens(uid);

    await writeAuditLog({
      orgId: after.orgId,
      actorUid: caller.uid,
      action: 'user.setRole',
      targetRef: `users/${uid}`,
      before,
      after,
    });

    return after;
  },
);
