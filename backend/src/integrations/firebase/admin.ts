/**
 * @archivo admin.ts
 * @descripcion Capa de integración de Firebase Admin SDK para OfiAI.
 * Proporciona referencias centralizadas a los servicios de Firebase Authentication, Firestore y Storage.
 * @modulo Integrations/Firebase
 */

import admin from 'firebase-admin';
import { getFirebaseApp, getFirestore, getAuth, getStorage } from '../../config/firebase';

// Asegura que Firebase Admin SDK esté inicializado
export const firebaseAdminApp = getFirebaseApp();

/**
 * Instancia del SDK principal de Firebase Admin.
 */
export const firebaseAdmin = admin;

/**
 * Instancia central de base de datos Firestore.
 */
export const firestore = getFirestore();

/**
 * Instancia central del servicio de autenticación de Firebase Admin.
 */
export const firebaseAuth = getAuth();

/**
 * Instancia central del servicio de almacenamiento Firebase Storage.
 */
export const firebaseStorage = getStorage();