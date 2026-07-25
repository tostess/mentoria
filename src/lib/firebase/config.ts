/**
 * Configuracao do SDK web, lida SEMPRE de variaveis de ambiente.
 *
 * Todo acesso a `process.env` aqui e ESTATICO — o Next so inlina
 * `NEXT_PUBLIC_*` no bundle do browser dessa forma. A validacao fica em
 * `@/lib/env`, que recebe o valor ja lido.
 */

import { required } from '@/lib/env';

export function getFirebaseConfig() {
  return {
    apiKey: required('NEXT_PUBLIC_FIREBASE_API_KEY', process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: required(
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    ),
    projectId: required(
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    ),
    storageBucket: required(
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    ),
    messagingSenderId: required(
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    ),
    appId: required('NEXT_PUBLIC_FIREBASE_APP_ID', process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  };
}

/** CLAUDE.md: Cloud Functions em southamerica-east1. */
export function getFunctionsRegion(): string {
  return process.env.NEXT_PUBLIC_FUNCTIONS_REGION || 'southamerica-east1';
}

/** Nome sem prefixo `use` de proposito: nao e hook, e leitura de env. */
export function emulatorsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';
}
