/**
 * @archivo mobile/src/constants/index.ts
 * @descripcion Constantes globales para la aplicación móvil de OfiAI.
 * @modulo Mobile Constants
 */

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

/** Expo requiere referencias estaticas para insertar solo configuracion publica al compilar. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
export const MERCADO_PAGO_PUBLIC_KEY = process.env.EXPO_PUBLIC_MERCADOPAGO_PUBLIC_KEY || '';
export const DEMO_ACCESS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_DEMO_ACCESS === 'true'
  || (process.env.EXPO_PUBLIC_ENABLE_DEMO_ACCESS !== 'false' && typeof __DEV__ !== 'undefined' && __DEV__);

export const FIREBASE_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
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
