/**
 * @archivo mobile/src/types/index.ts
 * @descripcion Tipos globales para la aplicación móvil de OfiAI.
 * @modulo Mobile Types
 */
export type RolUsuario = 'empresa' | 'profesional' | 'admin';
export type EstadoTrabajo = 'borrador' | 'publicado' | 'en_revision' | 'en_progreso' | 'completado' | 'cancelado';
export type PlanSuscripcion = import('../../../shared/billing').BillingPlanId;

export interface UsuarioMobile {
  uid: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
  pais: string;
  fotoPerfil?: string;
  plan?: PlanSuscripcion;
}

export interface TrabajoMobile {
  id: string;
  titulo: string;
  categoria: string;
  ciudad: string;
  estado: EstadoTrabajo;
  compatibilidadIa: number;
}

export interface NotificacionMobile {
  id: string;
  titulo: string;
  descripcion: string;
  leida: boolean;
}

export interface ApiEnvelope<T> {
  exito: boolean;
  mensaje?: string;
  datos?: T;
}

export type AuthStackParamList = {
  Login: undefined;
  Registro: { rol?: Exclude<RolUsuario, 'admin'> } | undefined;
  RecuperarPassword: undefined;
};

export type AppTabParamList = {
  Coordinator: undefined;
  JobCoordinator: { jobId: string };
  JobPricing: { jobId: string };
  JobMatches: { jobId: string };
  SolicitudIA: undefined;
  Profesionales: undefined;
  Analytics: undefined;
  Admin: undefined;
  Dashboard: undefined;
  Trabajos: undefined;
  Perfil: undefined;
  Suscripciones: undefined;
  Operaciones: undefined;
  IA: undefined;
  Notificaciones: undefined;
  Configuracion: undefined;
};
