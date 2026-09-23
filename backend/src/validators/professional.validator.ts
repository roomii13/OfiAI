/**
 * @archivo professional.validator.ts
 * @descripcion Esquemas de validación para operaciones de profesionales en OfiAI.
 * @modulo Validators
 */
import { z } from 'zod';

export const esquemaCoordenadasProfesional = z.object({
  latitud: z.number().min(-90).max(90),
  longitud: z.number().min(-180).max(180),
});

export const esquemaCrearProfesional = z.object({
  habilidades: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  provincia: z.string().trim().min(1).max(100).optional(),
  radioServicioKm: z.number().finite().min(0).max(2000).optional(),
  precioMinimo: z.number().finite().nonnegative().optional(),
  disponibilidadHoraria: z.array(z.object({
    dia: z.enum(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']),
    desde: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    hasta: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  }).strict().refine(day => day.desde < day.hasta, 'El horario debe finalizar despues del inicio')).max(14).optional(),
  especialidades: z.array(z.string()).min(1, 'Debe tener al menos una especialidad'),
  categorias: z.array(z.string()).min(1, 'Debe tener al menos una categoría'),
  descripcionPerfil: z.string().optional(),
  aniosExperiencia: z.number().min(0).max(60),
  tarifaHora: z.number().positive().optional(),
  tarifaHoraMateriales: z.enum(['included', 'excluded', 'unknown']).optional(),
  tarifaHoraImpuestos: z.enum(['included', 'excluded', 'unknown']).optional(),
  tarifaServicio: z.number().positive().optional(),
  moneda: z.string().min(3).max(3).optional(),
  ciudad: z.string().min(1, 'La ciudad es requerida'),
  zonaCobertura: z.array(z.string()).optional(),
  coordenadas: esquemaCoordenadasProfesional.optional(),
});

export const esquemaActualizarProfesional = esquemaCrearProfesional.partial().extend({
  disponible: z.boolean().optional(),
  verificado: z.boolean().optional(),
});

export const esquemaFiltrosProfesional = z.object({
  categoria: z.string().optional(),
  especialidad: z.string().optional(),
  ciudad: z.string().optional(),
  pais: z.string().optional(),
  disponible: z.string().transform((valor) => valor === 'true').optional(),
  verificado: z.string().transform((valor) => valor === 'true').optional(),
  limite: z.string().transform((valor) => parseInt(valor, 10)).optional(),
});

export type DatosCrearProfesional = z.infer<typeof esquemaCrearProfesional>;
export type DatosActualizarProfesional = z.infer<typeof esquemaActualizarProfesional>;
export type FiltrosProfesional = z.infer<typeof esquemaFiltrosProfesional>;
