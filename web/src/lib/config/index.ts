/**
 * @archivo lib/config/index.ts
 * @descripcion Configuración global de la aplicación web OfiAI.
 * @modulo Lib
 */
export const configuracion = {
  app: {
    nombre: 'OfiAI',
    version: '1.0.0',
    descripcion: 'Plataforma SaaS con IA para profesionales de oficios en LATAM',
  },
  api: {
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1',
    timeout: 30000,
  },
  // TODO: Agregar configuración de Firebase
  // TODO: Agregar configuración de Stripe (publishable key)
  // TODO: Agregar configuración de Google Maps
} as const;
