/**
 * Configuracao do Firebase lida SEMPRE de variaveis de ambiente.
 * Nenhuma chave hardcoded no repositorio.
 *
 * A leitura e preguicosa de proposito: se fosse avaliada no import, um `next
 * build` sem `.env.local` quebraria na prerenderizacao. Assim o erro aparece
 * onde importa — na hora de falar com o Firebase — e com nome da variavel.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variavel de ambiente ausente: ${name}. Copie .env.example para .env.local e preencha.`,
    );
  }
  return value;
}

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
  return process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true';
}
