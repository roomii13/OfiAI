/**
 * @archivo contracts.ts
 * @descripcion Contratos JSON de la API compartidos por web y mobile.
 */
export type Role = 'empresa' | 'profesional' | 'admin';
export type JobStatus = 'borrador' | 'publicado' | 'en_revision' | 'en_progreso' | 'completado' | 'cancelado';
/** Metadatos del listado paginado de empresas. */
export interface PaginationData { total: number; pagina: number; limite: number; totalPaginas: number }
export interface ApiResult<T> { exito: boolean; datos: T; mensaje?: string; paginacion?: PaginationData }
export interface DashboardData {
  rol: Role;
  kpis: Record<string, number | boolean | string>;
  metricas: Record<string, number | string>;
  resumenTrabajos: Record<string, number>;
  estadisticas: Record<string, Array<{ etiqueta: string; total: number }>>;
  actividadReciente: Array<{ id: string; tipo: string; titulo: string; descripcion: string; fecha: string }>;
}
export interface JobData {
  id: string; empresaId: string; titulo: string; descripcion: string; categoria: string;
  estado: JobStatus; ciudad?: string; presupuestoMinimo?: number; presupuestoMaximo?: number;
  moneda: string; tipoTrabajo: 'presencial' | 'remoto' | 'hibrido'; puntajeMatchingIA?: number;
}
export interface CreateJobData {
  titulo: string; descripcion: string; categoria: string; ciudad: string;
  tipoTrabajo: JobData['tipoTrabajo']; presupuestoMaximo?: number; moneda: string;
}
export interface ProfessionalData {
  id: string; nombre: string; apellido: string; especialidades: string[]; ciudad: string;
  calificacionPromedio: number; totalResenas: number; disponible: boolean; verificado: boolean;
}
export interface CompanyData {
  id: string; nombreEmpresa: string; industria: string; ciudad: string;
  totalContrataciones: number; planSuscripcion?: string; suscripcionActiva: boolean; activo: boolean;
}
export interface NotificationData { id: string; titulo: string; mensaje: string; leida: boolean }
export interface NotificationPreferences { email: boolean; whatsapp: boolean; push: boolean; in_app: boolean }
export interface AccountData {
  usuario: { id: string; nombre: string; apellido?: string; email: string; rol: Role; pais: string;
    preferenciasNotificaciones?: NotificationPreferences };
}
export interface PlanData {
  id: 'gratuito' | 'profesional' | 'empresa'; nombre: string; precioMensual: number; moneda: string;
  limitesEmpresa: Record<string, number>; limitesProfesional: Record<string, number>;
}
export interface SubscriptionData { id: string; plan: PlanData['id']; estado: string; renovacionAutomatica: boolean }
export interface AdminUserData { id: string; nombre: string; email: string; rol: Role; activo: boolean }
export interface UsageData {
  eventosPorTipo: Record<string, number>; eventosPorRol: Record<string, number>;
  trabajosPorEstado: Record<string, number>; suscripcionesPorPlan: Record<string, number>;
}
