/**
 * @archivo job.validator.ts
 * @descripcion Esquemas de validación para publicación de trabajos en OfiAI.
 * @modulo Validators
 */
import { z } from 'zod';

export const esquemaCrearTrabajo = z.object({
  titulo: z.string().min(5, 'El título debe tener al menos 5 caracteres'),
  descripcion: z.string().min(20, 'La descripción debe ser más detallada'),
  categoria: z.string().min(1, 'La categoría es requerida'),
  subcategoria: z.string().optional(),
  habilidadesRequeridas: z.array(z.string()).optional().default([]),
  presupuestoMinimo: z.number().positive().optional(),
  presupuestoMaximo: z.number().positive().optional(),
  tipoTrabajo: z.enum(['presencial', 'remoto', 'hibrido']),
  ciudad: z.string().optional(),
  fechaInicio: z.string().datetime().optional(),
});

export type DatosCrearTrabajo = z.infer<typeof esquemaCrearTrabajo>;
// TODO: Agregar validación cruzada presupuestoMin < presupuestoMax
