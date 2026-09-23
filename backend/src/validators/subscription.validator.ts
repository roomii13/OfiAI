/**
 * @archivo subscription.validator.ts
 * @descripcion Esquemas de validación para suscripciones SaaS de OfiAI.
 * @modulo Validators
 */
import { z } from 'zod';

export const esquemaPlanSuscripcion = z.enum(['gratuito', 'profesional', 'empresa']);

export const esquemaSuscribirse = z.object({
  plan: esquemaPlanSuscripcion,
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  cupon: z.string().trim().min(2).max(60).optional(),
});

export type DatosSuscribirse = z.infer<typeof esquemaSuscribirse>;

export const esquemaCancelarSuscripcion = z.object({
  motivo: z.string().trim().min(3).max(280).optional(),
  cancelarAlFinalDelPeriodo: z.boolean().default(true),
});

export type DatosCancelarSuscripcion = z.infer<typeof esquemaCancelarSuscripcion>;
