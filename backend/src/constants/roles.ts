/**
 * @archivo roles.ts
 * @descripcion Constantes de roles de usuario para OfiAI.
 * Fuente única de verdad para todos los roles del sistema.
 */
export const ROLES = {
  EMPRESA: 'empresa',
  PROFESIONAL: 'profesional',
  ADMIN: 'admin',
} as const;

export type Rol = typeof ROLES[keyof typeof ROLES];
