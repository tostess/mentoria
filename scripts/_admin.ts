import 'dotenv/config';

import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Admin SDK para scripts de linha de comando. Le a mesma credencial do app
 * (.env.local -> FIREBASE_SERVICE_ACCOUNT ou GOOGLE_APPLICATION_CREDENTIALS).
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

if (!getApps().length) {
  initializeApp({
    credential: credential(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

export const db = getFirestore();
export const auth = getAuth();

export function arg(name: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index >= 0) return process.argv[index + 1];
  const inline = process.argv.find((a) => a.startsWith(`${flag}=`));
  return inline?.slice(flag.length + 1);
}

export function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
