/**
 * @archivo status.ts
 * @descripcion Enumeraciones de estados del sistema OfiAI.
 * Fuente única de verdad para todos los estados de entidades.
 */
export const ESTADOS_TRABAJO = {
  BORRADOR: 'borrador',
  PUBLICADO: 'publicado',
  EN_REVISION: 'en_revision',
  EN_PROGRESO: 'en_progreso',
  COMPLETADO: 'completado',
  CANCELADO: 'cancelado',
} as const;

export const ESTADOS_PROPUESTA = {
  ENVIADA: 'enviada',
  VISTA: 'vista',
  ACEPTADA: 'aceptada',
  RECHAZADA: 'rechazada',
  RETIRADA: 'retirada',
} as const;

export const ESTADOS_SUSCRIPCION = {
  ACTIVA: 'activa',
  VENCIDA: 'vencida',
  CANCELADA: 'cancelada',
  TRIAL: 'trial',
} as const;
