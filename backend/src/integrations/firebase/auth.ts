/**
 * @archivo auth.ts
 * @descripcion Operaciones directas con Firebase Authentication mediante Admin SDK.
 * @modulo Integrations/Firebase
 */

import { firebaseAuth } from './admin';
import type { UserRecord, DecodedIdToken } from 'firebase-admin/auth';
import { RolUsuario } from '../../models/User';
import { logger } from '../../config/logger';

/**
 * Crea un nuevo usuario en Firebase Authentication y le asigna su rol como custom claim.
 * @param email - Correo electrónico del usuario.
 * @param password - Contraseña del usuario.
 * @param nombre - Nombre para mostrar (displayName).
 * @param rol - Rol de usuario ('empresa' | 'profesional' | 'admin').
 * @returns Promesa que resuelve en la UserRecord de Firebase.
 */
export async function createFirebaseUser(
  email: string,
  password: string,
  nombre: string,
  rol: RolUsuario
): Promise<UserRecord> {
  try {
    const userRecord = await firebaseAuth.createUser({
      email,
      password,
      displayName: nombre,
      emailVerified: false,
    });

    // Asignar el rol en las Custom User Claims de Firebase
    await setCustomUserClaims(userRecord.uid, { rol });
    logger.info(`🔥 Usuario Firebase creado exitosamente. UID: ${userRecord.uid}, Rol: ${rol}`);

    return userRecord;
  } catch (error) {
    logger.error('Error al crear usuario en Firebase Authentication:', { email, error });
    throw error;
  }
}

/**
 * Establece claims personalizadas en el token del usuario en Firebase Auth.
 * @param uid - UID del usuario.
 * @param claims - Objeto de claims a adjuntar.
 */
export async function setCustomUserClaims(
  uid: string,
  claims: Record<string, unknown>
): Promise<void> {
  await firebaseAuth.setCustomUserClaims(uid, claims);
}

/**
 * Obtiene el registro de un usuario en Firebase Auth mediante su UID.
 * @param uid - Identificador único de usuario.
 */
export async function getFirebaseUser(uid: string): Promise<UserRecord> {
  return await firebaseAuth.getUser(uid);
}

/**
 * Obtiene el registro de un usuario en Firebase Auth mediante su email.
 * @param email - Correo electrónico del usuario.
 */
export async function getFirebaseUserByEmail(email: string): Promise<UserRecord | null> {
  try {
    return await firebaseAuth.getUserByEmail(email);
  } catch (error: unknown) {
    const code = (error as { code?: string }).code;
    if (code === 'auth/user-not-found') {
      return null;
    }
    throw error;
  }
}

/**
 * Verifica y decodifica un token ID emitido por Firebase Auth.
 * @param token - Token JWT de ID.
 */
export async function verifyFirebaseToken(token: string): Promise<DecodedIdToken> {
  return await firebaseAuth.verifyIdToken(token);
}

/**
 * Genera un enlace oficial para restablecimiento de contraseña.
 * @param email - Correo electrónico del destinatario.
 */
export async function generatePasswordResetLink(email: string): Promise<string> {
  return await firebaseAuth.generatePasswordResetLink(email);
}

/**
 * Revoca todos los refresh tokens de un usuario en Firebase Auth (Logout forzado/Seguridad).
 * @param uid - UID del usuario.
 */
export async function revokeUserRefreshTokens(uid: string): Promise<void> {
  await firebaseAuth.revokeRefreshTokens(uid);
  logger.info(`Tokens revocados para usuario UID: ${uid}`);
}

/**
 * Elimina un usuario de Firebase Auth.
 * @param uid - UID del usuario a eliminar.
 */
export async function deleteFirebaseUser(uid: string): Promise<void> {
  await firebaseAuth.deleteUser(uid);
  logger.info(`Usuario eliminado de Firebase Auth UID: ${uid}`);
}