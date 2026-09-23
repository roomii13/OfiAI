/**
 * @archivo lib/config/index.ts
 * @descripcion Configuración global de la aplicación web OfiAI.
 * @modulo Lib
 */
const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

/**
 * Configuración pública consumida por el frontend web.
 */
export const configuracion = {
  app: {
    nombre: 'OfiAI',
    version: '1.0.0',
    descripcion: 'Plataforma SaaS con IA para profesionales de oficios en LATAM',
    demoAccessEnabled: import.meta.env.VITE_ENABLE_DEMO_ACCESS === 'true'
      || (!import.meta.env.PROD && import.meta.env.VITE_ENABLE_DEMO_ACCESS !== 'false'),
  },
  api: {
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1',
    timeout: 30000,
  },
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: firebaseProjectId || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${firebaseProjectId || 'ofiai'}.appspot.com`,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
  },
  mercadoPago: {
    publicKey: import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || '',
  },
  firestore: {
    databaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || '(default)',
  },
  googleMaps: {
    apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    defaultCountry: import.meta.env.VITE_DEFAULT_COUNTRY || 'AR',
  },
} as const;
