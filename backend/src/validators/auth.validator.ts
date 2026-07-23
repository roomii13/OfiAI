/**
 * @archivo auth.validator.ts
 * @descripcion Esquemas de validación con Zod para el módulo de autenticación en OfiAI.
 * @modulo Validators
 */
import { z } from 'zod';

export const codigosPaisEnum = z.enum(['MX', 'CO', 'CL', 'AR', 'PE', 'EC', 'VE', 'BO', 'PY', 'UY']);

/**
 * Esquema de validación para registro de Empresa.
 */
export const esquemaRegistroEmpresa = z.object({
  email: z.string().email('Debe proporcionar un correo electrónico válido'),
  password: z.string().min(8, 'La contraseña debe contener al menos 8 caracteres'),
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  apellido: z.string().optional(),
  pais: codigosPaisEnum,
  nombreEmpresa: z.string().min(2, 'El nombre de la empresa es obligatorio'),
  industria: z.string().min(2, 'La industria es obligatoria'),
  tamanoEmpresa: z.enum(['micro', 'pequena', 'mediana', 'grande']),
  ciudad: z.string().min(2, 'La ciudad es obligatoria'),
  rut: z.string().optional(),
  telefono: z.string().optional(),
});

/**
 * Esquema de validación para registro de Profesional.
 */
export const esquemaRegistroProfesional = z.object({
  email: z.string().email('Debe proporcionar un correo electrónico válido'),
  password: z.string().min(8, 'La contraseña debe contener al menos 8 caracteres'),
  nombre: z.string().min(2, 'El nombre es obligatorio'),
  apellido: z.string().min(2, 'El apellido es obligatorio'),
  pais: codigosPaisEnum,
  especialidades: z.array(z.string()).min(1, 'Debe indicar al menos una especialidad'),
  categorias: z.array(z.string()).min(1, 'Debe indicar al menos una categoría'),
  aniosExperiencia: z.number().min(0, 'Los años de experiencia deben ser mayores o iguales a 0'),
  ciudad: z.string().min(2, 'La ciudad es obligatoria'),
  tarifaHora: z.number().positive().optional(),
  telefono: z.string().optional(),
});

/**
 * Esquema de inicio de sesión.
 */
export const esquemaLogin = z.object({
  email: z.string().email('Debe proporcionar un correo electrónico válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

/**
 * Esquema de recuperación de contraseña.
 */
export const esquemaRecuperarPassword = z.object({
  email: z.string().email('Debe proporcionar un correo electrónico válido'),
});

export type DatosRegistroEmpresa = z.infer<typeof esquemaRegistroEmpresa>;
export type DatosRegistroProfesional = z.infer<typeof esquemaRegistroProfesional>;
export type DatosLogin = z.infer<typeof esquemaLogin>;
export type DatosRecuperarPassword = z.infer<typeof esquemaRecuperarPassword>;
