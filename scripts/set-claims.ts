import { FieldValue } from 'firebase-admin/firestore';

import { DEFAULT_ORG_ID, isRole } from '../src/lib/auth/roles';
import { arg, auth, db } from './_admin';

/**
 * Define custom claims de um usuario pelo e-mail. Serve para criar o PRIMEIRO
 * admin — depois disso, use o callable `setUserRole`, que ja registra auditLog.
 *
 *   npm run claims:set -- --email voce@exemplo.com --role admin
 *   npm run claims:set -- --email x@y.com --role moderator --org public
 *
 * `mentor` e aceito aqui apenas para testes locais; em producao o mentor nasce
 * de `mentorInvites` (invariante 7).
 */
async function main() {
  const email = arg('email');
  const role = arg('role');
  const orgId = arg('org') ?? DEFAULT_ORG_ID;

  if (!email || !isRole(role)) {
    console.error('Uso: npm run claims:set -- --email <email> --role <mentee|mentor|moderator|admin> [--org <orgId>]');
    process.exit(1);
    return;
  }

  const user = await auth.getUserByEmail(email);
  const before = user.customClaims ?? null;
  const after = { role, orgId };

  await auth.setCustomUserClaims(user.uid, after);
  await db.collection('users').doc(user.uid).set(
    {
      uid: user.uid,
      email,
      ...after,
    },
    { merge: true },
  );
  await auth.revokeRefreshTokens(user.uid);

  await db.collection('auditLogs').add({
    orgId,
    actorUid: 'script:cli',
    action: 'user.setRole',
    targetRef: `users/${user.uid}`,
    before,
    after,
    at: FieldValue.serverTimestamp(),
  });

  console.log(`${email} -> role=${role} orgId=${orgId}. Faca logout/login para o token novo.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
