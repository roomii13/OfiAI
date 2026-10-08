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
  /** Permiso superior validado por el servidor; no sustituye el rol operativo compatible. */
  financialRole?: 'OWNER';
  /** Los particulares usan permisos de contratante, sin una suscripcion empresarial. */
  tipoCuenta?: 'empresa' | 'particular' | 'profesional' | 'admin';
  pais: CodigoPais;
  idioma: 'es-LA' | 'es-MX' | 'es-CO' | 'es-CL' | 'es-AR' | 'es-PE' | 'en-US';
  emailVerificado: boolean;
  activo: boolean;
  fechaCreacion: Date;
  fechaActualizacion: Date;
  ultimoAcceso?: Date;
  preferenciasNotificaciones?: { email: boolean; whatsapp: boolean; push: boolean; in_app: boolean };
}
