/**
 * @archivo firebase.ts
 * @descripcion Inicialización y exportación de clientes de Firebase Admin SDK para OfiAI.
 * Proporciona acceso centralizado a Firestore, Firebase Auth y Firebase Storage con soporte para credenciales explícitas o Application Default Credentials (ADC).
 * @modulo Config
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore as firestoreSdk, type Firestore } from 'firebase-admin/firestore';
import { getAuth as authSdk, type Auth } from 'firebase-admin/auth';
import { getStorage as storageSdk, type Storage } from 'firebase-admin/storage';
import { env } from './env';
import { logger } from './logger';

let appInicializada: App | null = null;
let firestoreConfigurado = false;

/**
 * Inicializa la aplicación de Firebase Admin SDK si no ha sido inicializada previamente.
 * Soporta autenticación mediante Service Account o credenciales por defecto en Google Cloud Run.
 * @returns Instancia de la aplicación inicializada de Firebase.
 */
export const initializeFirebase = (): App => {
  if (appInicializada) {
    return appInicializada;
  }

  if (getApps().length > 0) {
    appInicializada = getApps()[0]!;
    return appInicializada;
  }

  try {
    const tieneCredencialesDirectas =
      env.FIREBASE_PROJECT_ID &&
      env.FIREBASE_CLIENT_EMAIL &&
      env.FIREBASE_PRIVATE_KEY;

    if (tieneCredencialesDirectas) {
      appInicializada = initializeApp({
        credential: cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey: env.FIREBASE_PRIVATE_KEY,
        }),
        storageBucket: env.FIREBASE_STORAGE_BUCKET || `${env.FIREBASE_PROJECT_ID}.appspot.com`,
      });
      logger.info('🔥 Firebase Admin SDK inicializado con credenciales explícitas de servicio.');
    } else {
      // Fallback a Application Default Credentials (ADC) en entorno Google Cloud Run
      appInicializada = initializeApp({
        projectId: env.FIREBASE_PROJECT_ID || env.GCP_PROJECT_ID,
        storageBucket: env.FIREBASE_STORAGE_BUCKET,
      });
      logger.info('🔥 Firebase Admin SDK inicializado mediante Application Default Credentials (ADC).');
    }

    return appInicializada;
  } catch (error) {
    logger.error('❌ Error crítico al inicializar Firebase Admin SDK:', { error });
    throw new Error('Fallo en la inicialización de Firebase Admin SDK.');
  }
};

/**
 * Obtiene la instancia activa de la aplicación de Firebase Admin.
 */
export const getFirebaseApp = (): App => {
  return initializeFirebase();
};

/**
 * Obtiene el cliente Firestore para la base indicada en FIREBASE_DATABASE_ID.
 * @returns Instancia de Firestore.
 */
export const getFirestore = (): Firestore => {
  const app = getFirebaseApp();
  const db = firestoreSdk(app, env.FIREBASE_DATABASE_ID);
  if (!firestoreConfigurado) {
    db.settings({ ignoreUndefinedProperties: true });
    firestoreConfigurado = true;
  }
  return db;
};

/**
 * Obtiene el cliente de autenticación de Firebase.
 * @returns Instancia de Firebase Auth.
 */
export const getAuth = (): Auth => {
  const app = getFirebaseApp();
  return authSdk(app);
};

/**
 * Obtiene el cliente del servicio de almacenamiento de Firebase Storage.
 * @returns Instancia de Firebase Storage.
 */
export const getStorage = (): Storage => {
  const app = getFirebaseApp();
  return storageSdk(app);
};
