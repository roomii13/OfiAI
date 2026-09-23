/**
 * @archivo index.ts
 * @descripcion Exportaciones públicas de Firebase Admin SDK para OfiAI.
 * Provee Auth, Firestore, Storage y utilidades de autenticación al resto del backend.
 * @modulo Integrations
 */

export {
  firebaseAdmin,
  firebaseAdminApp,
  firebaseAuth,
  firebaseStorage,
  firestore,
} from './admin';

export {
  createFirebaseUser,
  deleteFirebaseUser,
  generatePasswordResetLink,
  getFirebaseUser,
  getFirebaseUserByEmail,
  revokeUserRefreshTokens,
  setCustomUserClaims,
  verifyFirebaseToken,
} from './auth';
