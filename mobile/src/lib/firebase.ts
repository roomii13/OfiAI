/**
 * @archivo mobile/src/lib/firebase.ts
 * @descripcion Inicialización de Firebase cliente para autenticación móvil de OfiAI.
 * Permite intercambiar custom tokens del backend por ID tokens válidos para rutas privadas.
 * @modulo Mobile Lib
 */
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { FIREBASE_CONFIG } from '../constants';

/**
 * Indica si el entorno móvil tiene la configuración pública mínima de Firebase.
 */
export function hasMobileFirebaseConfig(): boolean {
  return Boolean(
    FIREBASE_CONFIG.apiKey &&
    FIREBASE_CONFIG.authDomain &&
    FIREBASE_CONFIG.projectId &&
    FIREBASE_CONFIG.appId
  );
}

/**
 * Inicializa o reutiliza la aplicación Firebase móvil.
 */
function createMobileFirebaseApp(): FirebaseApp | null {
  if (!hasMobileFirebaseConfig()) {
    return null;
  }

  return getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
}

export const firebaseAppMobile: FirebaseApp | null = createMobileFirebaseApp();
export const firebaseAuthMobile: Auth | null = firebaseAppMobile ? getAuth(firebaseAppMobile) : null;
