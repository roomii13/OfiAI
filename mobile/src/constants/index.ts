/**
 * @archivo mobile/src/constants/index.ts
 * @descripcion Constantes globales para la aplicación móvil de OfiAI.
 * @modulo Mobile Constants
 */
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;

export const COLORES_MARCA = {
  primario: '#6c32e8',
  secundario: '#9379f9',
  claro: '#f0f0ff',
  oscuro: '#280f5c',
  exito: '#10b981',
  advertencia: '#f59e0b',
  error: '#ef4444',
  fondo: '#f8f8fc',
  texto: '#1e1b4b',
};

export const API_URL = env?.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
export const MERCADO_PAGO_PUBLIC_KEY = env?.EXPO_PUBLIC_MERCADOPAGO_PUBLIC_KEY || '';
export const DEMO_ACCESS_ENABLED = env?.EXPO_PUBLIC_ENABLE_DEMO_ACCESS === 'true'
  || (env?.EXPO_PUBLIC_ENABLE_DEMO_ACCESS !== 'false' && typeof __DEV__ !== 'undefined' && __DEV__);

export const FIREBASE_CONFIG = {
  apiKey: env?.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: env?.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: env?.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: env?.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env?.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env?.EXPO_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: env?.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
} as const;

export const RUTAS_NAVEGACION = {
  LOGIN: 'Login',
  REGISTRO: 'Registro',
  RECUPERAR_PASSWORD: 'RecuperarPassword',
  DASHBOARD_EMPRESA: 'DashboardEmpresa',
  DASHBOARD_PROFESIONAL: 'DashboardProfesional',
  DASHBOARD_ADMIN: 'DashboardAdmin',
  TRABAJOS: 'Trabajos',
  PERFIL: 'Perfil',
  IA: 'IA',
  NOTIFICACIONES: 'Notificaciones',
  CONFIGURACION: 'Configuracion',
} as const;

export const ESPACIADO = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
