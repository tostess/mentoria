import 'server-only';

import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * Admin SDK — unica via de escrita em `bookings`, `wallets`, `auditLogs` e
 * `appConfig` (invariantes 3, 4 e 11). Nunca importar em componente de cliente.
 *
 * Credencial, em ordem: FIREBASE_SERVICE_ACCOUNT (JSON inline) ->
 * GOOGLE_APPLICATION_CREDENTIALS (caminho) -> credencial padrao do ambiente.
 */
function credential() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (inline) {
    const parsed = JSON.parse(inline) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
    return cert({
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key.replace(/\\n/g, '\n'),
    });
  }
  return applicationDefault();
}

let cached: { app: App; auth: Auth; db: Firestore } | null = null;

export function getAdmin() {
  if (cached) return cached;

  const app = getApps().length
    ? getApps()[0]!
    : initializeApp({
        credential: credential(),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });

  const db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });

  cached = { app, auth: getAuth(app), db };
  return cached;
}
