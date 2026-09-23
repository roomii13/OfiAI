import type * as FirebaseFirestore from 'firebase-admin/firestore';
/**
 * @archivo notification.repository.ts
 * @descripcion Repositorio Firestore para notificaciones multicanal de OfiAI.
 * Gestiona creación, lectura, estados de envío y selección de reintentos.
 * @modulo Repositories
 */

import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { Notificacion } from '../models/Notification';

/**
 * Repositorio de notificaciones sobre Firestore.
 */
class NotificationRepository {
  private get coleccion() {
    return firestore.collection(COLECCIONES.NOTIFICACIONES);
  }

  /**
   * Crea una notificación.
   */
  async create(notificacion: Notificacion): Promise<Notificacion> {
    await this.coleccion.doc(notificacion.id).set(notificacion);
    return notificacion;
  }

  /**
   * Busca una notificación por ID.
   */
  async findById(id: string): Promise<Notificacion | null> {
    const doc = await this.coleccion.doc(id).get();
    return doc.exists ? doc.data() as Notificacion : null;
  }

  /**
   * Lista notificaciones internas de un usuario.
   */
  async findByUserId(usuarioId: string, limite = 50): Promise<Notificacion[]> {
    const snapshot = await this.coleccion
      .where('usuarioId', '==', usuarioId)
      .limit(limite)
      .get();

    return snapshot.docs.map((doc) => doc.data() as Notificacion);
  }

  /**
   * Actualiza campos parciales de una notificación.
   */
  async update(id: string, data: Partial<Notificacion>): Promise<void> {
    await this.coleccion.doc(id).update(data);
  }

  /**
   * Busca notificaciones pendientes o en reintento para envío.
   */
  async findRetryable(limite = 50): Promise<Notificacion[]> {
    const snapshot = await this.coleccion
      .where('estado', 'in', ['pendiente', 'reintentando'])
      .limit(limite)
      .get();
    const ahora = Date.now();

    return snapshot.docs
      .map((doc) => doc.data() as Notificacion)
      .filter((notificacion) => !notificacion.proximoIntento || this.obtenerTiempo(notificacion.proximoIntento) <= ahora);
  }

  /**
   * Convierte Date o Timestamp a milisegundos.
   */
  private obtenerTiempo(fecha: Date | FirebaseFirestore.Timestamp): number {
    return fecha instanceof Date ? fecha.getTime() : fecha.toDate().getTime();
  }
}

export const notificationRepository = new NotificationRepository();
