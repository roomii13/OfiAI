/**
 * @archivo collections.ts
 * @descripcion Nombres de colecciones de Firestore para OfiAI.
 * Fuente única de verdad para todos los nombres de colecciones.
 * Evita errores de tipografía y facilita renombrar colecciones.
 */
export const COLECCIONES = {
  USUARIOS: 'users',
  EMPRESAS: 'companies',
  PROFESIONALES: 'professionals',
  TRABAJOS: 'jobs',
  PROPUESTAS: 'proposals',
  RESENAS: 'reviews',
  SUSCRIPCIONES: 'subscriptions',
  NOTIFICACIONES: 'notifications',
  // Subcolecciones
  // TRABAJOS/{trabajoId}/PROPUESTAS: 'proposals'
  // USUARIOS/{usuarioId}/NOTIFICACIONES: 'notifications'
} as const;

export type NombreColeccion = typeof COLECCIONES[keyof typeof COLECCIONES];
