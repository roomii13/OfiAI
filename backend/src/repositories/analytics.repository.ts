/**
 * @archivo analytics.repository.ts
 * @descripcion Repositorio Firestore para eventos y reportes de Analytics de OfiAI.
 * Centraliza persistencia de métricas, reportes generados y eventos de uso.
 * @modulo Repositories
 */

import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { EventoAnalytics, ReporteAnalytics } from '../models/analytics.model';

/**
 * Repositorio de Analytics sobre Firestore.
 */
class AnalyticsRepository {
  private get eventos() {
    return firestore.collection(COLECCIONES.ANALYTICS_EVENTOS);
  }

  private get reportes() {
    return firestore.collection(COLECCIONES.ANALYTICS_REPORTES);
  }

  /**
   * Registra un evento de uso o negocio.
   */
  async createEvent(evento: EventoAnalytics): Promise<EventoAnalytics> {
    await this.eventos.doc(evento.id).set(evento);
    return evento;
  }

  /**
   * Lista eventos dentro de un rango de fechas.
   */
  async listEvents(fechaInicio: Date, fechaFin: Date, limite = 500): Promise<EventoAnalytics[]> {
    const snapshot = await this.eventos
      .where('fechaCreacion', '>=', fechaInicio)
      .where('fechaCreacion', '<=', fechaFin)
      .limit(limite)
      .get();

    return snapshot.docs.map((doc) => doc.data() as EventoAnalytics);
  }

  /**
   * Guarda un reporte de Analytics.
   */
  async saveReport(reporte: ReporteAnalytics): Promise<ReporteAnalytics> {
    await this.reportes.doc(reporte.id).set(reporte);
    return reporte;
  }

  /**
   * Obtiene un reporte por ID.
   */
  async findReportById(id: string): Promise<ReporteAnalytics | null> {
    const doc = await this.reportes.doc(id).get();
    return doc.exists ? doc.data() as ReporteAnalytics : null;
  }
}

export const analyticsRepository = new AnalyticsRepository();
