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
  AI_INTAKE_SESSIONS: 'ai_intake_sessions',
  MATCHES: 'matches',
  MATCHING: 'matching',
  PRICING: 'pricing',
  PRICING_QUOTES: 'pricing_quotes',
  PRICING_ESTIMATES: 'pricing_estimates',
  PRICING_AUDIT: 'pricing_audit',
  PROPUESTAS: 'proposals',
  RESENAS: 'reviews',
  SUSCRIPCIONES: 'subscriptions',
  HISTORIAL_SUSCRIPCIONES: 'subscription_history',
  NOTIFICACIONES: 'notifications',
  ANALYTICS_EVENTOS: 'analytics_events',
  ANALYTICS_REPORTES: 'analytics_reports',
} as const;

export type NombreColeccion = typeof COLECCIONES[keyof typeof COLECCIONES];
