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
};

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export const RUTAS_NAVEGACION = {
  // Auth
  LOGIN: 'Login',
  REGISTRO: 'Registro',
  RECUPERAR_PASSWORD: 'RecuperarPassword',
  // Dashboard
  DASHBOARD_EMPRESA: 'DashboardEmpresa',
  DASHBOARD_PROFESIONAL: 'DashboardProfesional',
  DASHBOARD_ADMIN: 'DashboardAdmin',
  // Features
  TRABAJOS: 'Trabajos',
  PERFIL: 'Perfil',
  NOTIFICACIONES: 'Notificaciones',
  CONFIGURACION: 'Configuracion',
} as const;
