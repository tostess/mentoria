'use client';

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';

import { emulatorsEnabled, getFirebaseConfig, getFunctionsRegion } from '@/lib/firebase/config';

let cached: {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  functions: Functions;
  storage: FirebaseStorage;
} | null = null;

/**
 * SDK de cliente. Lembre-se: o cliente NUNCA escreve `bookings` nem `wallets`
 * (invariante 4) — essas operacoes passam por callable.
 */
export function getFirebase() {
  if (cached) return cached;

  const app = getApps().length ? getApp() : initializeApp(getFirebaseConfig());
  const auth = getAuth(app);
  const db = getFirestore(app);
  const functions = getFunctions(app, getFunctionsRegion());
  const storage = getStorage(app);

  if (emulatorsEnabled()) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
  }

  cached = { app, auth, db, functions, storage };
  return cached;
}
