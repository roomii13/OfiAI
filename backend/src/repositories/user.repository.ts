/**
 * @archivo user.repository.ts
 * @descripcion Capa de acceso a datos para la colección de usuarios en Firestore.
 * Abstrae todas las consultas y escrituras a la base de datos de usuarios de OfiAI.
 * @modulo Repositories
 */

import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { Usuario } from '../models/User';
import { logger } from '../config/logger';
import { hasOwnerGrant, isOwnerRole, ROLES } from '../constants/roles';
import { PROTECTED_COLLECTIONS } from '../constants/protected-payments';
import type { FinancialGrant } from '../models/protected-contract.model';

/** Proyecta identidades persistidas al contrato de acceso sin reescribir sus roles. */
class UserRepository {
  private get coleccion() {
    return firestore.collection(COLECCIONES.USUARIOS);
  }

  /** Conserva OWNER en Firestore y entrega capacidades administrativas solo con permiso vigente. */
  private async toUser(uid: string, data: Record<string, unknown>): Promise<Usuario | null> {
    const storedOwner = isOwnerRole(data.rol);
    if (!storedOwner && !Object.values(ROLES).includes(data.rol as Usuario['rol'])) return null;
    const { financialRole: _untrustedFinancialRole, ...profile } = data;
    if (storedOwner || data.rol === ROLES.ADMIN) {
      const grant = (await firestore.collection(PROTECTED_COLLECTIONS.grants).doc(uid).get()).data() as FinancialGrant | undefined;
      const owner = data.activo === true && hasOwnerGrant(uid, data.email, grant);
      if (storedOwner && !owner) return null;
      return { ...profile, id: uid, rol: ROLES.ADMIN, ...(owner ? { financialRole: 'OWNER' } : {}) } as Usuario;
    }
    return { ...profile, id: uid } as Usuario;
  }

  /**
   * Crea un nuevo documento de usuario en la colección Firestore.
   * @param usuario - Objeto completo del modelo Usuario.
   */
  async create(usuario: Usuario): Promise<Usuario> {
    try {
      await this.coleccion.doc(usuario.id).set({
        ...usuario,
        fechaCreacion: usuario.fechaCreacion || new Date(),
        fechaActualizacion: usuario.fechaActualizacion || new Date(),
      });
      logger.info(`📄 Documento de usuario creado en Firestore. UID: ${usuario.id}`);
      return usuario;
    } catch (error) {
      logger.error(`Error al crear documento de usuario en Firestore UID: ${usuario.id}`, { error });
      throw error;
    }
  }

  /**
   * Busca un usuario en Firestore por su identificador único (UID).
   * @param uid - UID del usuario.
   * @returns Instancia de Usuario o null si no se encuentra.
   */
  async findById(uid: string): Promise<Usuario | null> {
    try {
      const doc = await this.coleccion.doc(uid).get();
      if (!doc.exists) {
        return null;
      }
      return await this.toUser(doc.id, doc.data()!);
    } catch (error) {
      logger.error(`Error al buscar usuario por UID: ${uid}`, { error });
      throw error;
    }
  }

  /**
   * Busca un usuario en Firestore por su correo electrónico.
   * @param email - Correo electrónico del usuario.
   * @returns Instancia de Usuario o null si no existe.
   */
  async findByEmail(email: string): Promise<Usuario | null> {
    try {
      const snapshot = await this.coleccion.where('email', '==', email).limit(1).get();
      if (snapshot.empty) {
        return null;
      }
      const doc = snapshot.docs[0]!;
      return await this.toUser(doc.id, doc.data());
    } catch (error) {
      logger.error(`Error al buscar usuario por email: ${email}`, { error });
      throw error;
    }
  }

  /**
   * Actualiza los datos de un usuario en Firestore.
   * @param uid - UID del usuario a actualizar.
   * @param data - Datos parciales a modificar.
   */
  async update(uid: string, data: Partial<Usuario>): Promise<void> {
    try {
      await this.coleccion.doc(uid).update({
        ...data,
        fechaActualizacion: new Date(),
      });
      logger.info(`📄 Documento de usuario actualizado en Firestore. UID: ${uid}`);
    } catch (error) {
      logger.error(`Error al actualizar usuario en Firestore UID: ${uid}`, { error });
      throw error;
    }
  }

  /**
   * Elimina lógicamente un usuario marcándolo como inactivo.
   * @param uid - UID del usuario.
   */
  async delete(uid: string): Promise<void> {
    try {
      await this.coleccion.doc(uid).update({
        activo: false,
        fechaActualizacion: new Date(),
      });
      logger.info(`📄 Usuario marcado como inactivo en Firestore. UID: ${uid}`);
    } catch (error) {
      logger.error(`Error al desactivar usuario en Firestore UID: ${uid}`, { error });
      throw error;
    }
  }
}

export const userRepository = new UserRepository();
