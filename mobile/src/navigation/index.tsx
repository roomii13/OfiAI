/**
 * @archivo mobile/src/navigation/index.tsx
 * @descripcion Configuración de navegación para la app móvil de OfiAI.
 * Define los stacks de navegación por rol (empresa/profesional/admin).
 * @modulo Mobile Navigation
 */
import { ReactNode } from 'react';
// TODO: Implementar con @react-navigation
// import { NavigationContainer } from '@react-navigation/native';
// import { createNativeStackNavigator } from '@react-navigation/native-stack';

/**
 * Router principal de la aplicación móvil.
 * TODO: Implementar rutas de autenticación (Login, Registro, RecuperarPassword)
 * TODO: Implementar rutas de empresa (DashboardEmpresa, PublicarTrabajo, etc.)
 * TODO: Implementar rutas de profesional (DashboardProfesional, MisPropuestas, etc.)
 * TODO: Implementar rutas de admin (DashboardAdmin, GestionUsuarios, etc.)
 * TODO: Redirigir según estado de autenticación y rol del usuario
 */
export const AppNavigator = ({ children }: { children?: ReactNode }) => {
  // TODO: Retornar NavigationContainer con el stack correcto
  return <>{children}</>;
};
