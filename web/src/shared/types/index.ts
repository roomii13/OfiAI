/**
 * @archivo shared/types/index.ts
 * @descripcion Tipos compartidos de la aplicación web OfiAI.
 * @modulo Shared Types
 */
export type RolUsuario = 'empresa' | 'profesional' | 'admin';
export type EstadoTrabajo = 'borrador' | 'publicado' | 'en_revision' | 'en_progreso' | 'completado' | 'cancelado';
export type EstadoSuscripcion = 'activa' | 'cancelada' | 'vencida' | 'prueba';
export type PlanSuscripcion = import('../../../../shared/billing').BillingPlanId;

export interface RespuestaAPI<T> {
  exito: boolean;
  datos?: T;
  mensaje?: string;
  errores?: string[];
}

export interface PaginacionOpciones {
  pagina: number;
  limite: number;
  total?: number;
}

export interface FiltrosBusqueda {
  categoria?: string;
  ciudad?: string;
  presupuestoMin?: number;
  presupuestoMax?: number;
  calificacionMin?: number;
  disponible?: boolean;
}

export interface KpiDashboard {
  etiqueta: string;
  valor: string;
  variacion: string;
  tono: 'positivo' | 'neutral' | 'alerta';
}

export interface TrabajoResumen {
  id: string;
  titulo: string;
  categoria: string;
  estado: EstadoTrabajo;
  presupuesto: number;
  ciudad: string;
  compatibilidadIa?: number;
}

export interface ProfesionalResumen {
  id: string;
  nombre: string;
  especialidad: string;
  ciudad: string;
  calificacion: number;
  disponible: boolean;
  compatibilidadIa: number;
}

export interface ActividadReciente {
  id: string;
  titulo: string;
  detalle: string;
  fechaRelativa: string;
  tipo: 'trabajo' | 'ia' | 'pago' | 'notificacion' | 'sistema';
}

export interface SuscripcionResumen {
  plan: PlanSuscripcion;
  estado: EstadoSuscripcion;
  proximaRenovacion?: string;
  proveedorPago: 'mercado_pago';
}
