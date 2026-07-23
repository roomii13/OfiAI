/**
 * @archivo shared/types/index.ts
 * @descripcion Tipos compartidos de la aplicación web OfiAI.
 * @modulo Shared Types
 */
export type RolUsuario = 'empresa' | 'profesional' | 'admin';

export interface RespuestaAPI<T> {
  exito: boolean;
  datos?: T;
  mensaje?: string;
  errores?: string[];
}

export interface PaginacionOpciones {
  pagina: number;
  limite: number;
  total?: number;
}

export interface FiltrosBusqueda {
  categoria?: string;
  ciudad?: string;
  presupuestoMin?: number;
  presupuestoMax?: number;
  calificacionMin?: number;
  disponible?: boolean;
}
// TODO: Agregar tipos específicos por feature conforme se implementen
