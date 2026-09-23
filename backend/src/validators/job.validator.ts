/**
 * @archivo job.validator.ts
 * @descripcion Esquemas de validación para publicación de trabajos en OfiAI.
 * @modulo Validators
 */
import { z } from 'zod';

export const esquemaCoordenadasTrabajo = z.object({
  latitud: z.number().min(-90).max(90),
  longitud: z.number().min(-180).max(180),
});

/** Valida el intervalo de presupuesto. */
const validarPresupuestoTrabajo = (datos: { presupuestoMinimo?: number; presupuestoMaximo?: number }): boolean => {
  if (!datos.presupuestoMinimo || !datos.presupuestoMaximo) {
    return true;
  }

  return datos.presupuestoMinimo <= datos.presupuestoMaximo;
};

const esquemaTrabajoBase = z.object({
  titulo: z.string().min(5, 'El título debe tener al menos 5 caracteres'),
  descripcion: z.string().min(20, 'La descripción debe ser más detallada'),
  categoria: z.string().trim().min(1, 'La categoría es requerida'),
  subcategoria: z.string().optional(),
  habilidadesRequeridas: z.array(z.string()).optional().default([]),
  presupuestoMinimo: z.number().positive().optional(),
  presupuestoMaximo: z.number().positive().optional(),
  moneda: z.string().min(3).max(3).optional(),
  tipoTrabajo: z.enum(['presencial', 'remoto', 'hibrido']),
  ciudad: z.string().optional(),
  direccion: z.string().optional(),
  coordenadas: esquemaCoordenadasTrabajo.optional(),
  fechaInicio: z.string().datetime().transform((valor) => new Date(valor)).optional(),
  fechaFin: z.string().datetime().transform((valor) => new Date(valor)).optional(),
  estado: z.enum(['borrador', 'publicado', 'en_revision', 'en_progreso', 'completado', 'cancelado']).optional(),
});

export const esquemaCrearTrabajo = esquemaTrabajoBase.refine(validarPresupuestoTrabajo, {
  message: 'El presupuesto mínimo no puede ser mayor que el presupuesto máximo.',
  path: ['presupuestoMinimo'],
});

export const esquemaActualizarTrabajo = esquemaTrabajoBase.partial().refine(validarPresupuestoTrabajo, {
  message: 'El presupuesto mínimo no puede ser mayor que el presupuesto máximo.',
  path: ['presupuestoMinimo'],
});

export const esquemaFiltrosTrabajo = z.object({
  empresaId: z.string().optional(),
  estado: z.enum(['borrador', 'publicado', 'en_revision', 'en_progreso', 'completado', 'cancelado']).optional(),
  categoria: z.string().optional(),
  ciudad: z.string().optional(),
  tipoTrabajo: z.enum(['presencial', 'remoto', 'hibrido']).optional(),
  limite: z.coerce.number().int().min(1).max(100).default(50),
});

export type DatosCrearTrabajo = z.infer<typeof esquemaCrearTrabajo>;
export type DatosActualizarTrabajo = z.infer<typeof esquemaActualizarTrabajo>;
export type FiltrosTrabajo = z.infer<typeof esquemaFiltrosTrabajo>;
