/**
 * @archivo permissions.ts
 * @descripcion Permisos granulares del sistema RBAC de OfiAI.
 * Define qué acciones puede realizar cada rol.
 */
import { RolUsuario } from '../models/User';

export const PERMISOS = {
  TRABAJO_CREAR: 'trabajo:crear',
  TRABAJO_EDITAR: 'trabajo:editar',
  TRABAJO_ELIMINAR: 'trabajo:eliminar',
  TRABAJO_VER_TODOS: 'trabajo:ver_todos',
  TRABAJO_POSTULAR: 'trabajo:postular',
  PROPUESTA_CREAR: 'propuesta:crear',
  PROPUESTA_ACEPTAR: 'propuesta:aceptar',
  USUARIO_GESTIONAR: 'usuario:gestionar',
  USUARIO_SUSPENDER: 'usuario:suspender',
  IA_MATCHING: 'ia:matching',
  IA_PRICING: 'ia:pricing',
  IA_CHAT: 'ia:chat',
  SUSCRIPCION_GESTIONAR: 'suscripcion:gestionar',
  ANALYTICS_VER: 'analytics:ver',
  ADMIN_DASHBOARD: 'admin:dashboard',
  ADMIN_METRICAS: 'admin:metricas',
} as const;

export type Permiso = typeof PERMISOS[keyof typeof PERMISOS];

export const PERMISOS_POR_ROL: Record<RolUsuario, Permiso[]> = {
  empresa: [
    PERMISOS.TRABAJO_CREAR,
    PERMISOS.TRABAJO_EDITAR,
    PERMISOS.TRABAJO_ELIMINAR,
    PERMISOS.TRABAJO_VER_TODOS,
    PERMISOS.PROPUESTA_ACEPTAR,
    PERMISOS.IA_MATCHING,
    PERMISOS.IA_PRICING,
    PERMISOS.IA_CHAT,
    PERMISOS.SUSCRIPCION_GESTIONAR,
    PERMISOS.ANALYTICS_VER,
  ],
  profesional: [
    PERMISOS.TRABAJO_VER_TODOS,
    PERMISOS.TRABAJO_POSTULAR,
    PERMISOS.PROPUESTA_CREAR,
    PERMISOS.IA_PRICING,
    PERMISOS.IA_CHAT,
    PERMISOS.SUSCRIPCION_GESTIONAR,
  ],
  admin: Object.values(PERMISOS),
};

/**
 * Verifica si un rol posee un permiso específico.
 */
export const rolTienePermiso = (rol: RolUsuario, permiso: Permiso): boolean => {
  return PERMISOS_POR_ROL[rol].includes(permiso);
};
