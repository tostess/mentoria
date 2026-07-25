import { FieldValue } from 'firebase-admin/firestore';

import { DEFAULT_APP_CONFIG } from '../src/lib/config/defaults';
import { DEFAULT_ORG_ID } from '../src/lib/auth/roles';
import { arg, db, hasFlag } from './_admin';

/**
 * Cria `orgs/{orgId}` e `appConfig/{orgId}` com os defaults do CLAUDE.md.
 *
 *   npm run seed:config                 # org 'public'
 *   npm run seed:config -- --org acme   # outra org
 *   npm run seed:config -- --force      # sobrescreve o que ja existe
 *
 * Sem `--force` o script nao toca em documento existente: personalizacao
 * publicada pelo admin nao pode ser perdida por um seed acidental.
 */
async function main() {
  const orgId = arg('org') ?? DEFAULT_ORG_ID;
  const force = hasFlag('force');

  const orgRef = db.collection('orgs').doc(orgId);
  const configRef = db.collection('appConfig').doc(orgId);

  const [orgSnap, configSnap] = await Promise.all([orgRef.get(), configRef.get()]);

  if (!orgSnap.exists) {
    await orgRef.set({
      name: orgId === DEFAULT_ORG_ID ? 'Marketplace aberto' : orgId,
      plan: orgId === DEFAULT_ORG_ID ? 'public' : 'sponsor',
      active: true,
      createdAt: FieldValue.serverTimestamp(),
    });
    console.log(`orgs/${orgId} criado.`);
  } else {
    console.log(`orgs/${orgId} ja existe — mantido.`);
  }

  if (configSnap.exists && !force) {
    console.log(`appConfig/${orgId} ja existe — nada feito. Use --force para sobrescrever.`);
    return;
  }

  await configRef.set({
    ...DEFAULT_APP_CONFIG,
    orgId,
    version: configSnap.exists ? ((configSnap.data()?.version as number) ?? 1) + 1 : 1,
    publishedBy: 'script:seed',
    publishedAt: new Date().toISOString(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db.collection('auditLogs').add({
    orgId,
    actorUid: 'script:seed',
    action: 'appConfig.seed',
    targetRef: `appConfig/${orgId}`,
    before: configSnap.exists ? (configSnap.data() ?? null) : null,
    after: { version: 'ver documento' },
    at: FieldValue.serverTimestamp(),
  });

  console.log(`appConfig/${orgId} gravado com os defaults da tabela de economia.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
