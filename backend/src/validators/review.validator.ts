/** @archivo review.validator.ts @descripcion Validacion cerrada de resenas; no admite autor ni profesional desde el cliente. */
import { z } from 'zod';
const stars = z.number().int().min(1).max(5);
export const reviewSchema = z.object({
  calificacion: stars,
  comentario: z.string().trim().min(10).max(1500),
  calificacionesDetalladas: z.object({
    puntualidad: stars, calidadTrabajo: stars, comunicacion: stars,
  }).strict().optional(),
}).strict();
