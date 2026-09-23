/**
 * @archivo analytics.model.ts
 * @descripcion Modelos de datos para eventos, KPIs, reportes y exportaciones de Analytics en OfiAI.
 * Define estructuras compartidas por repositorio, servicio y controladores.
 * @modulo Models
 */

import { RolUsuario } from './User';

export type PeriodoAnalytics = 'diario' | 'semanal' | 'mensual';
export type FormatoExportacionAnalytics = 'json' | 'csv';
export type TipoEventoAnalytics =
  | 'usuario_registrado'
  | 'login'
  | 'trabajo_creado'
  | 'trabajo_completado'
  | 'matching_ejecutado'
  | 'consulta_ia'
  | 'checkout_creado'
  | 'suscripcion_activada'
  | 'notificacion_enviada';

export interface EventoAnalytics {
  id: string;
  tipo: TipoEventoAnalytics;
  usuarioId?: string;
  rol?: RolUsuario;
  entidadId?: string;
  entidadTipo?: string;
  metadata?: Record<string, string | number | boolean>;
  fechaCreacion: Date;
}

export interface KpisAnalytics {
  usuariosTotales: number;
  empresasActivas: number;
  profesionalesActivos: number;
  trabajosTotales: number;
  trabajosCompletados: number;
  suscripcionesActivas: number;
  ingresosMensualesRecurrentes: number;
  consultasIA: number;
  notificacionesEnviadas: number;
}

export interface EstadisticasUsoAnalytics {
  eventosPorTipo: Record<string, number>;
  eventosPorRol: Record<string, number>;
  trabajosPorEstado: Record<string, number>;
  suscripcionesPorPlan: Record<string, number>;
}

export interface ReporteAnalytics {
  id: string;
  periodo: PeriodoAnalytics;
  kpis: KpisAnalytics;
  estadisticasUso: EstadisticasUsoAnalytics;
  fechaInicio: Date;
  fechaFin: Date;
  fechaCreacion: Date;
}

export interface ExportacionAnalytics {
  formato: FormatoExportacionAnalytics;
  nombreArchivo: string;
  contenido: string;
}
