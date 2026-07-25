import 'server-only';

import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import { optionalEnv, requiredEnv } from '@/lib/env';

/**
 * Admin SDK — unica via de escrita em `bookings`, `wallets`, `auditLogs` e
 * `appConfig` (invariantes 3, 4 e 11). Nunca importar em componente de cliente:
 * o `server-only` acima transforma isso em erro de build, nao em vazamento.
 *
 * Credencial: os tres campos da conta de servico, lidos do ambiente. O JSON
 * baixado do console NAO entra no repositorio — so os valores em `.env.local`.
 */

/** Sem prefixo `use`: nao e hook, e leitura de env (o lint do Next confunde). */
const emulatorsEnabled = () => process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';

/**
 * Com emulador, o Admin SDK nao valida credencial: basta apontar os hosts. E o
 * que permite `npm run dev:emu` funcionar sem conta de servico nenhuma.
 * Os nomes das variaveis sao os que o proprio SDK procura.
 */
function pointToEmulators() {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
}

function credential() {
  if (emulatorsEnabled()) return applicationDefault();
  return cert({
    projectId: requiredEnv('FIREBASE_ADMIN_PROJECT_ID'),
    clientEmail: requiredEnv('FIREBASE_ADMIN_CLIENT_EMAIL'),
    // A private_key vive em uma linha no .env, com `\n` escapado.
    privateKey: requiredEnv('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n'),
  });
}

function projectId(): string {
  if (emulatorsEnabled()) {
    // `singleProjectMode` no firebase.json: um id qualquer serve, mas manter o
    // mesmo do .firebaserc evita avisos do emulador.
    return optionalEnv('FIREBASE_ADMIN_PROJECT_ID', 'mentoria');
  }
  return requiredEnv('FIREBASE_ADMIN_PROJECT_ID');
}

let cached: { app: App; auth: Auth; db: Firestore } | null = null;

export function getAdmin() {
  if (cached) return cached;

  if (emulatorsEnabled()) pointToEmulators();

  const app = getApps().length
    ? getApps()[0]!
    : initializeApp({ credential: credential(), projectId: projectId() });

  const db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });

  cached = { app, auth: getAuth(app), db };
  return cached;
}
