/**
 * @archivo professional.validator.ts
 * @descripcion Esquemas de validación para operaciones de profesionales en OfiAI.
 * @modulo Validators
 */
import { z } from 'zod';

export const esquemaCrearProfesional = z.object({
  especialidades: z.array(z.string()).min(1, 'Debe tener al menos una especialidad'),
  categorias: z.array(z.string()).min(1, 'Debe tener al menos una categoría'),
  descripcionPerfil: z.string().optional(),
  aniosExperiencia: z.number().min(0).max(60),
  tarifaHora: z.number().positive().optional(),
  ciudad: z.string().min(1, 'La ciudad es requerida'),
  zonaCobertura: z.array(z.string()).optional(),
});

export type DatosCrearProfesional = z.infer<typeof esquemaCrearProfesional>;
// TODO: Agregar validación de documentos de identidad
// TODO: Agregar validación de certificaciones
