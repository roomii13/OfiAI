/**
 * @archivo mobile/src/types/index.ts
 * @descripcion Tipos globales para la aplicación móvil de OfiAI.
 * @modulo Mobile Types
 */
export type RolUsuario = 'empresa' | 'profesional' | 'admin';

export interface UsuarioMobile {
  uid: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
  pais: string;
  fotoPerfil?: string;
}

// TODO: Definir tipos de navegación para React Navigation
// TODO: Agregar tipos de parámetros de pantallas
