/**
 * @archivo company.validator.ts
 * @descripcion Esquemas de validación con Zod para el módulo de empresas en OfiAI.
 * @modulo Validators
 */
import { z } from 'zod';
import { codigosPaisEnum } from './auth.validator';

/**
 * Esquema para la creación de perfil de Empresa.
 */
export const esquemaCrearEmpresa = z.object({
  nombreEmpresa: z.string().min(2, 'El nombre de la empresa es requerido'),
  industria: z.string().min(1, 'La industria es requerida'),
  tamanoEmpresa: z.enum(['micro', 'pequena', 'mediana', 'grande']),
  pais: codigosPaisEnum,
  ciudad: z.string().min(1, 'La ciudad es requerida'),
  descripcion: z.string().optional(),
  sitioWeb: z.string().url('Formato de URL inválido').optional().or(z.literal('')),
  rut: z.string().optional(),
  direccion: z.string().optional(),
});

/**
 * Esquema para la actualización parcial de Empresa.
 */
export const esquemaActualizarEmpresa = esquemaCrearEmpresa.partial();

/**
 * Esquema para filtros y paginación en búsquedas de Empresa.
 */
export const esquemaFiltrosEmpresa = z.object({
  industria: z.string().optional(),
  tamanoEmpresa: z.enum(['micro', 'pequena', 'mediana', 'grande']).optional(),
  ciudad: z.string().optional(),
  pais: codigosPaisEnum.optional(),
  pagina: z.string().transform((val) => parseInt(val, 10)).default('1'),
  limite: z.string().transform((val) => parseInt(val, 10)).default('10'),
});

export type DatosCrearEmpresa = z.infer<typeof esquemaCrearEmpresa>;
export type DatosActualizarEmpresa = z.infer<typeof esquemaActualizarEmpresa>;
export type FiltrosEmpresa = z.infer<typeof esquemaFiltrosEmpresa>;
