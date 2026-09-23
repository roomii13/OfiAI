/**
 * @archivo subscription.repository.ts
 * @descripcion Repositorio Firestore para suscripciones, historial y búsqueda por proveedor de pagos.
 * Aísla persistencia del módulo Suscripciones siguiendo Clean Architecture.
 * @modulo Repositories
 */

import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { Suscripcion } from '../models/Subscription';
import { HistorialSuscripcion } from '../models/subscription.model';
import { logger } from '../config/logger';

/**
 * Repositorio de suscripciones sobre Firestore.
 */
class SubscriptionRepository {
  private get coleccionSuscripciones() {
    return firestore.collection(COLECCIONES.SUSCRIPCIONES);
  }

  private get coleccionHistorial() {
    return firestore.collection(COLECCIONES.HISTORIAL_SUSCRIPCIONES);
  }

  /**
   * Crea una suscripción.
   */
  async create(suscripcion: Suscripcion): Promise<Suscripcion> {
    await this.coleccionSuscripciones.doc(suscripcion.id).set(suscripcion);
    logger.info(`Suscripción creada: ${suscripcion.id}`);
    return suscripcion;
  }

  /**
   * Busca una suscripción por ID.
   */
  async findById(id: string): Promise<Suscripcion | null> {
    const doc = await this.coleccionSuscripciones.doc(id).get();
    return doc.exists ? doc.data() as Suscripcion : null;
  }

  /**
   * Busca la suscripción activa o pendiente más reciente de un usuario.
   */
  async findCurrentByUserId(usuarioId: string): Promise<Suscripcion | null> {
    const snapshot = await this.coleccionSuscripciones
      .where('usuarioId', '==', usuarioId)
      .where('estado', 'in', ['activa', 'trial', 'pendiente_pago'])
      .limit(1)
      .get();

    return snapshot.docs[0]?.data() as Suscripcion | undefined ?? null;
  }

  /**
   * Busca una suscripción por identificador de preapproval de Mercado Pago.
   */
  async findByMercadoPagoPreapprovalId(mercadoPagoPreapprovalId: string): Promise<Suscripcion | null> {
    const snapshot = await this.coleccionSuscripciones
      .where('mercadoPagoPreapprovalId', '==', mercadoPagoPreapprovalId)
      .limit(1)
      .get();

    return snapshot.docs[0]?.data() as Suscripcion | undefined ?? null;
  }

  /**
   * Lista historial completo de suscripciones de un usuario.
   */
  async findHistoryByUserId(usuarioId: string, limite = 50): Promise<Suscripcion[]> {
    const snapshot = await this.coleccionSuscripciones
      .where('usuarioId', '==', usuarioId)
      .limit(limite)
      .get();

    return snapshot.docs.map((doc) => doc.data() as Suscripcion);
  }

  /**
   * Actualiza campos parciales de una suscripción.
   */
  async update(id: string, data: Partial<Suscripcion>): Promise<void> {
    await this.coleccionSuscripciones.doc(id).update({
      ...data,
      fechaActualizacion: new Date(),
    });
    logger.info(`Suscripción actualizada: ${id}`);
  }

  /**
   * Registra un evento de historial de suscripción.
   */
  async addHistory(evento: Omit<HistorialSuscripcion, 'id' | 'fecha'>): Promise<HistorialSuscripcion> {
    const id = this.coleccionHistorial.doc().id;
    const historial: HistorialSuscripcion = {
      ...evento,
      id,
      fecha: new Date(),
    };

    await this.coleccionHistorial.doc(id).set(historial);
    return historial;
  }

  /**
   * Lista eventos de historial operacional para un usuario.
   */
  async findOperationalHistoryByUserId(usuarioId: string, limite = 100): Promise<HistorialSuscripcion[]> {
    const snapshot = await this.coleccionHistorial
      .where('usuarioId', '==', usuarioId)
      .limit(limite)
      .get();

    return snapshot.docs.map((doc) => doc.data() as HistorialSuscripcion);
  }
}

export const subscriptionRepository = new SubscriptionRepository();
