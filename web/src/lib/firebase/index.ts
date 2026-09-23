/**
 * @archivo lib/firebase/index.ts
 * @descripcion Configuración e inicialización de Firebase para el cliente web de OfiAI.
 * @modulo Lib
 */
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { configuracion } from '../config';

/**
 * Indica si el entorno tiene los valores mínimos para inicializar Firebase.
 */
export function hasFirebaseConfig(): boolean {
  return Boolean(
    configuracion.firebase.apiKey &&
    configuracion.firebase.authDomain &&
    configuracion.firebase.projectId &&
    configuracion.firebase.appId
  );
}

/**
 * Crea o reutiliza la app Firebase cliente cuando la configuración está presente.
 */
function createFirebaseApp(): FirebaseApp | null {
  if (!hasFirebaseConfig()) {
    return null;
  }

  return getApps()[0] ?? initializeApp(configuracion.firebase);
}

export const firebaseApp = createFirebaseApp();
export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;
export const db: Firestore | null = firebaseApp ? getFirestore(firebaseApp, configuracion.firestore.databaseId) : null;
export const storage: FirebaseStorage | null = firebaseApp ? getStorage(firebaseApp) : null;

/**
 * Instancia diferida de Firebase Analytics para navegadores compatibles.
 */
export const analyticsPromise: Promise<Analytics | null> = firebaseApp
  ? isSupported().then((supported) => supported ? getAnalytics(firebaseApp) : null).catch(() => null)
  : Promise.resolve(null);
