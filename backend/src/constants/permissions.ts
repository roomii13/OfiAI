/**
 * @archivo permissions.ts
 * @descripcion Permisos granulares del sistema RBAC de OfiAI.
 * Define qué acciones puede realizar cada rol.
 * TODO: Implementar sistema completo de permisos
 */
export const PERMISOS = {
  // Trabajos
  TRABAJO_CREAR: 'trabajo:crear',
  TRABAJO_EDITAR: 'trabajo:editar',
  TRABAJO_ELIMINAR: 'trabajo:eliminar',
  TRABAJO_VER_TODOS: 'trabajo:ver_todos',
  // Propuestas
  PROPUESTA_CREAR: 'propuesta:crear',
  PROPUESTA_ACEPTAR: 'propuesta:aceptar',
  // Usuarios
  USUARIO_GESTIONAR: 'usuario:gestionar',
  USUARIO_SUSPENDER: 'usuario:suspender',
  // IA
  IA_MATCHING: 'ia:matching',
  IA_PRICING: 'ia:pricing',
  // Admin
  ADMIN_DASHBOARD: 'admin:dashboard',
  ADMIN_METRICAS: 'admin:metricas',
} as const;

// TODO: Mapear permisos por rol
export const PERMISOS_POR_ROL = {
  empresa: [] as string[],      // TODO: Definir permisos de empresa
  profesional: [] as string[], // TODO: Definir permisos de profesional
  admin: [] as string[],       // TODO: Admin tiene todos los permisos
};
