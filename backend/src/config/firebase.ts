/**
 * @archivo firebase.ts
 * @descripcion Inicialización y exportación de clientes de Firebase Admin SDK para OfiAI.
 * Proporciona acceso centralizado a Firestore, Firebase Auth y Firebase Storage con soporte para credenciales explícitas o Application Default Credentials (ADC).
 * @modulo Config
 */

import * as admin from 'firebase-admin';
import { env } from './env';
import { logger } from './logger';

let appInicializada: admin.app.App | null = null;

/**
 * Inicializa la aplicación de Firebase Admin SDK si no ha sido inicializada previamente.
 * Soporta autenticación mediante Service Account o credenciales por defecto en Google Cloud Run.
 * @returns Instancia de la aplicación inicializada de Firebase.
 */
export const initializeFirebase = (): admin.app.App => {
  if (appInicializada) {
    return appInicializada;
  }

  if (admin.apps.length > 0) {
    appInicializada = admin.apps[0]!;
    return appInicializada;
  }

  try {
    const tieneCredencialesDirectas =
      env.FIREBASE_PROJECT_ID &&
      env.FIREBASE_CLIENT_EMAIL &&
      env.FIREBASE_PRIVATE_KEY;

    if (tieneCredencialesDirectas) {
      appInicializada = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey: env.FIREBASE_PRIVATE_KEY,
        }),
        storageBucket: env.FIREBASE_STORAGE_BUCKET || `${env.FIREBASE_PROJECT_ID}.appspot.com`,
      });
      logger.info('🔥 Firebase Admin SDK inicializado con credenciales explícitas de servicio.');
    } else {
      // Fallback a Application Default Credentials (ADC) en entorno Google Cloud Run
      appInicializada = admin.initializeApp({
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
export const getFirebaseApp = (): admin.app.App => {
  return initializeFirebase();
};

/**
 * Obtiene el cliente de base de datos Firestore.
 * @returns Instancia de admin.firestore.Firestore.
 */
export const getFirestore = (): admin.firestore.Firestore => {
  const app = getFirebaseApp();
  return admin.firestore(app);
};

/**
 * Obtiene el cliente de autenticación de Firebase.
 * @returns Instancia de admin.auth.Auth.
 */
export const getAuth = (): admin.auth.Auth => {
  const app = getFirebaseApp();
  return admin.auth(app);
};

/**
 * Obtiene el cliente del servicio de almacenamiento de Firebase Storage.
 * @returns Instancia de admin.storage.Storage.
 */
export const getStorage = (): admin.storage.Storage => {
  const app = getFirebaseApp();
  return admin.storage(app);
};
