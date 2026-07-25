import { config } from 'dotenv';

// `dotenv/config` leria `.env`; o arquivo que o desenvolvedor preenche e
// `.env.local` (o unico ignorado pelo git). Carregar explicitamente.
config({ path: '.env.local' });

import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Admin SDK para scripts de linha de comando. Le a mesma credencial do app
 * (`.env.local` -> FIREBASE_ADMIN_*). Com NEXT_PUBLIC_USE_EMULATORS=true
 * aponta para os emuladores e dispensa credencial.
 */

const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variavel de ambiente ausente: ${name}. ` +
        'Copie .env.local.example para .env.local e preencha.',
    );
  }
  return value;
}

function credential() {
  if (useEmulators) return applicationDefault();
  return cert({
    projectId: required('FIREBASE_ADMIN_PROJECT_ID'),
    clientEmail: required('FIREBASE_ADMIN_CLIENT_EMAIL'),
    privateKey: required('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n'),
  });
}

if (useEmulators) {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
}

if (!getApps().length) {
  initializeApp({
    credential: credential(),
    projectId: useEmulators
      ? process.env.FIREBASE_ADMIN_PROJECT_ID || 'mentoria'
      : required('FIREBASE_ADMIN_PROJECT_ID'),
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
