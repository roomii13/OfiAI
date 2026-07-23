/**
 * @archivo User.ts
 * @descripcion Modelo de datos para usuarios de OfiAI.
 * Define la estructura base que comparten todos los tipos de usuario.
 * @modulo Modelos
 */

export type RolUsuario = 'empresa' | 'profesional' | 'admin';

export type CodigoPais = 'MX' | 'CO' | 'CL' | 'AR' | 'PE' | 'EC' | 'VE' | 'BO' | 'PY' | 'UY';

export interface Usuario {
  id: string;               // UID de Firebase Auth
  email: string;
  nombre: string;
  apellido?: string;
  telefono?: string;
  fotoPerfil?: string;      // URL en Firebase Storage
  rol: RolUsuario;
  pais: CodigoPais;
  idioma: 'es-LA' | 'es-MX' | 'es-CO' | 'es-CL' | 'es-AR' | 'es-PE' | 'en-US';
  emailVerificado: boolean;
  activo: boolean;
  fechaCreacion: Date;
  fechaActualizacion: Date;
  ultimoAcceso?: Date;
}
