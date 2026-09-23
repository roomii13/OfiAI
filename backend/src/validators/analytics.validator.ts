/**
 * @archivo analytics.validator.ts
 * @descripcion Esquemas de validación para endpoints de Analytics de OfiAI.
 * Valida eventos, periodos, rangos y formatos de exportación.
 * @modulo Validators
 */

import { z } from 'zod';

export const esquemaPeriodoAnalytics = z.enum(['diario', 'semanal', 'mensual']);
export const esquemaFormatoExportacionAnalytics = z.enum(['json', 'csv']);

export const esquemaRegistrarEventoAnalytics = z.object({
  tipo: z.enum([
    'usuario_registrado',
    'login',
    'trabajo_creado',
    'trabajo_completado',
    'matching_ejecutado',
    'consulta_ia',
    'checkout_creado',
    'suscripcion_activada',
    'notificacion_enviada',
  ]),
  entidadId: z.string().trim().min(1).optional(),
  entidadTipo: z.string().trim().min(1).max(80).optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const esquemaConsultaAnalytics = z.object({
  periodo: esquemaPeriodoAnalytics.optional(),
  fechaInicio: z.string().datetime().transform((valor) => new Date(valor)).optional(),
  fechaFin: z.string().datetime().transform((valor) => new Date(valor)).optional(),
});

export const esquemaGenerarReporteAnalytics = z.object({
  periodo: esquemaPeriodoAnalytics.default('mensual'),
});

export const esquemaExportarReporteAnalytics = z.object({
  formato: esquemaFormatoExportacionAnalytics.default('json'),
});

export type DatosRegistrarEventoAnalytics = z.infer<typeof esquemaRegistrarEventoAnalytics>;
export type DatosConsultaAnalytics = z.infer<typeof esquemaConsultaAnalytics>;
export type DatosGenerarReporteAnalytics = z.infer<typeof esquemaGenerarReporteAnalytics>;
export type DatosExportarReporteAnalytics = z.infer<typeof esquemaExportarReporteAnalytics>;
