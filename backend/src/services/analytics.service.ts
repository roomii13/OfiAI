/**
 * @archivo analytics.service.ts
 * @descripcion Servicio de Analytics para métricas, KPIs, reportes, eventos y exportación de OfiAI.
 * Calcula indicadores operativos desde Firestore y registra eventos de uso de la plataforma.
 * @modulo Services
 */

import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { ApiError } from '../middleware/error.middleware';
import { Trabajo } from '../models/Job';
import { Profesional } from '../models/Professional';
import { Empresa } from '../models/Company';
import { Suscripcion } from '../models/Subscription';
import { Notificacion } from '../models/Notification';
import { RolUsuario, Usuario } from '../models/User';
import {
  EstadisticasUsoAnalytics,
  EventoAnalytics,
  ExportacionAnalytics,
  FormatoExportacionAnalytics,
  KpisAnalytics,
  PeriodoAnalytics,
  ReporteAnalytics,
  TipoEventoAnalytics,
} from '../models/analytics.model';
import { analyticsRepository } from '../repositories/analytics.repository';

export interface EntradaRegistrarEventoAnalytics {
  tipo: TipoEventoAnalytics;
  entidadId?: string;
  entidadTipo?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface ConsultaAnalytics {
  periodo?: PeriodoAnalytics;
  fechaInicio?: Date;
  fechaFin?: Date;
}

/**
 * Servicio principal de métricas y reportes.
 */
class AnalyticsService {
  /**
   * Registra un evento analítico de producto o negocio.
   */
  async registrarEvento(
    entrada: EntradaRegistrarEventoAnalytics,
    usuarioId?: string,
    rol?: RolUsuario
  ): Promise<EventoAnalytics> {
    const evento: EventoAnalytics = {
      id: firestore.collection(COLECCIONES.ANALYTICS_EVENTOS).doc().id,
      tipo: entrada.tipo,
      usuarioId,
      rol,
      entidadId: entrada.entidadId,
      entidadTipo: entrada.entidadTipo,
      metadata: entrada.metadata,
      fechaCreacion: new Date(),
    };

    return analyticsRepository.createEvent(evento);
  }

  /**
   * Obtiene KPIs actuales de la plataforma.
   */
  async obtenerKpis(consulta: ConsultaAnalytics = {}): Promise<KpisAnalytics> {
    const rango = this.resolverRango(consulta);
    const [usuarios, empresas, profesionales, trabajos, suscripciones, notificaciones, eventos] = await Promise.all([
      this.obtenerDocumentos<Usuario>(COLECCIONES.USUARIOS),
      this.obtenerDocumentos<Empresa>(COLECCIONES.EMPRESAS),
      this.obtenerDocumentos<Profesional>(COLECCIONES.PROFESIONALES),
      this.obtenerDocumentos<Trabajo>(COLECCIONES.TRABAJOS),
      this.obtenerDocumentos<Suscripcion>(COLECCIONES.SUSCRIPCIONES),
      this.obtenerDocumentos<Notificacion>(COLECCIONES.NOTIFICACIONES),
      analyticsRepository.listEvents(rango.fechaInicio, rango.fechaFin),
    ]);

    const suscripcionesActivas = suscripciones.filter((suscripcion) => suscripcion.estado === 'activa');

    return {
      usuariosTotales: usuarios.filter((usuario) => usuario.activo !== false).length,
      empresasActivas: empresas.filter((empresa) => empresa.activo !== false).length,
      profesionalesActivos: profesionales.filter((profesional) => profesional.disponible !== false).length,
      trabajosTotales: trabajos.length,
      trabajosCompletados: trabajos.filter((trabajo) => trabajo.estado === 'completado').length,
      suscripcionesActivas: suscripcionesActivas.length,
      ingresosMensualesRecurrentes: this.redondear(suscripcionesActivas.reduce((total, suscripcion) => total + suscripcion.precioMensual, 0)),
      consultasIA: eventos.filter((evento) => evento.tipo === 'consulta_ia' || evento.tipo === 'matching_ejecutado').length,
      notificacionesEnviadas: notificaciones.filter((notificacion) => notificacion.enviada).length,
    };
  }

  /**
   * Obtiene estadísticas de uso y distribución de actividad.
   */
  async obtenerEstadisticasUso(consulta: ConsultaAnalytics = {}): Promise<EstadisticasUsoAnalytics> {
    const rango = this.resolverRango(consulta);
    const [eventos, trabajos, suscripciones] = await Promise.all([
      analyticsRepository.listEvents(rango.fechaInicio, rango.fechaFin),
      this.obtenerDocumentos<Trabajo>(COLECCIONES.TRABAJOS),
      this.obtenerDocumentos<Suscripcion>(COLECCIONES.SUSCRIPCIONES),
    ]);

    return {
      eventosPorTipo: this.contarPorClave(eventos, (evento) => evento.tipo),
      eventosPorRol: this.contarPorClave(eventos, (evento) => evento.rol ?? 'sin_rol'),
      trabajosPorEstado: this.contarPorClave(trabajos, (trabajo) => trabajo.estado),
      suscripcionesPorPlan: this.contarPorClave(suscripciones, (suscripcion) => suscripcion.plan),
    };
  }

  /**
   * Genera y persiste un reporte de Analytics para un periodo.
   */
  async generarReporte(periodo: PeriodoAnalytics): Promise<ReporteAnalytics> {
    const rango = this.resolverRango({ periodo });
    const [kpis, estadisticasUso] = await Promise.all([
      this.obtenerKpis(rango),
      this.obtenerEstadisticasUso(rango),
    ]);

    const reporte: ReporteAnalytics = {
      id: firestore.collection(COLECCIONES.ANALYTICS_REPORTES).doc().id,
      periodo,
      kpis,
      estadisticasUso,
      fechaInicio: rango.fechaInicio,
      fechaFin: rango.fechaFin,
      fechaCreacion: new Date(),
    };

    return analyticsRepository.saveReport(reporte);
  }

  /**
   * Exporta un reporte en formato JSON o CSV.
   */
  async exportarReporte(reporteId: string, formato: FormatoExportacionAnalytics): Promise<ExportacionAnalytics> {
    const reporte = await analyticsRepository.findReportById(reporteId);

    if (!reporte) {
      throw new ApiError('Reporte de Analytics no encontrado.', 404);
    }

    if (formato === 'json') {
      return {
        formato,
        nombreArchivo: `ofiai-analytics-${reporte.id}.json`,
        contenido: JSON.stringify(reporte, null, 2),
      };
    }

    return {
      formato,
      nombreArchivo: `ofiai-analytics-${reporte.id}.csv`,
      contenido: this.convertirReporteCsv(reporte),
    };
  }

  /**
   * Obtiene documentos de una colección con límite defensivo.
   */
  private async obtenerDocumentos<T>(coleccion: string, limite = 1000): Promise<T[]> {
    const snapshot = await firestore.collection(coleccion).limit(limite).get();
    return snapshot.docs.map((doc) => doc.data() as T);
  }

  /**
   * Resuelve rango temporal desde periodo o fechas explícitas.
   */
  private resolverRango(consulta: ConsultaAnalytics): { fechaInicio: Date; fechaFin: Date; periodo?: PeriodoAnalytics } {
    if (consulta.fechaInicio && consulta.fechaFin) {
      return {
        fechaInicio: consulta.fechaInicio,
        fechaFin: consulta.fechaFin,
        periodo: consulta.periodo,
      };
    }

    const fechaFin = new Date();
    const fechaInicio = new Date(fechaFin);
    const periodo = consulta.periodo ?? 'mensual';

    if (periodo === 'diario') {
      fechaInicio.setDate(fechaInicio.getDate() - 1);
    } else if (periodo === 'semanal') {
      fechaInicio.setDate(fechaInicio.getDate() - 7);
    } else {
      fechaInicio.setMonth(fechaInicio.getMonth() - 1);
    }

    return { fechaInicio, fechaFin, periodo };
  }

  /**
   * Cuenta elementos por clave derivada.
   */
  private contarPorClave<T>(items: T[], resolverClave: (item: T) => string): Record<string, number> {
    return items.reduce<Record<string, number>>((acumulado, item) => {
      const clave = resolverClave(item);
      acumulado[clave] = (acumulado[clave] ?? 0) + 1;
      return acumulado;
    }, {});
  }

  /**
   * Convierte un reporte a CSV plano para descarga.
   */
  private convertirReporteCsv(reporte: ReporteAnalytics): string {
    const filas = [
      ['seccion', 'metrica', 'valor'],
      ...Object.entries(reporte.kpis).map(([metrica, valor]) => ['kpis', metrica, String(valor)]),
      ...Object.entries(reporte.estadisticasUso.eventosPorTipo).map(([metrica, valor]) => ['eventos_por_tipo', metrica, String(valor)]),
      ...Object.entries(reporte.estadisticasUso.eventosPorRol).map(([metrica, valor]) => ['eventos_por_rol', metrica, String(valor)]),
      ...Object.entries(reporte.estadisticasUso.trabajosPorEstado).map(([metrica, valor]) => ['trabajos_por_estado', metrica, String(valor)]),
      ...Object.entries(reporte.estadisticasUso.suscripcionesPorPlan).map(([metrica, valor]) => ['suscripciones_por_plan', metrica, String(valor)]),
    ];

    return filas.map((fila) => fila.map((valor) => `"${valor.replace(/"/g, '""')}"`).join(',')).join('\n');
  }

  /**
   * Redondea valores monetarios y porcentuales.
   */
  private redondear(valor: number): number {
    return Math.round((valor + Number.EPSILON) * 100) / 100;
  }
}

export const analyticsService = new AnalyticsService();
