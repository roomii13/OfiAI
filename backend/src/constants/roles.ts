/**
 * @archivo roles.ts
 * @descripcion Constantes de roles de usuario para OfiAI.
 * Fuente única de verdad para todos los roles del sistema.
 */
import { FINANCIAL_OWNER_EMAILS } from './protected-payments';
import type { FinancialGrant } from '../models/protected-contract.model';
export const ROLES = {
  EMPRESA: 'empresa',
  PROFESIONAL: 'profesional',
  ADMIN: 'admin',
} as const;

export type Rol = typeof ROLES[keyof typeof ROLES];

/** Reconoce la etiqueta persistida de propietario sin cambiar el documento original. */
export function isOwnerRole(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toUpperCase() === 'OWNER';
}

/** El texto OWNER no otorga acceso sin correo autorizado y permiso activo ligado al UID. */
export function hasOwnerGrant(uid: string, email: unknown, grant: FinancialGrant | null | undefined): boolean {
  return typeof email === 'string' && FINANCIAL_OWNER_EMAILS.includes(email.trim().toLowerCase())
    && grant?.uid === uid && grant.role === 'OWNER' && grant.active === true;
}
