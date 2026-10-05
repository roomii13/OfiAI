/**
 * @archivo subscription.validator.ts
 * @descripcion Esquemas de validación para suscripciones SaaS de OfiAI.
 * @modulo Validators
 */
import { z } from 'zod';
import { billingPlanSchema } from '../constants/billing';

export const esquemaPlanSuscripcion = billingPlanSchema;

export const esquemaSuscribirse = z.object({
  plan: esquemaPlanSuscripcion,
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  expectedPriceMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
}).strict();

export type DatosSuscribirse = z.infer<typeof esquemaSuscribirse>;

export const esquemaCancelarSuscripcion = z.object({
  motivo: z.string().trim().min(3).max(280).optional(),
  cancelarAlFinalDelPeriodo: z.boolean().default(true),
}).strict();

export const esquemaCambioPlan = z.object({ plan: billingPlanSchema,
  expectedPriceMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional() }).strict();
export const esquemaCatalogo = z.object({ audience: z.enum(['empresa', 'profesional']).optional() }).strict();
export const esquemaRevenue = z.object({ month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/) }).strict();
export const esquemaFeePreview = z.object({ grossMinor: z.number().int().min(0).max(1000000000000) }).strict();
export const esquemaWebhook = z.object({
  type: z.string().max(100), action: z.string().max(100).optional(),
  data: z.object({ id: z.union([z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/), z.number().int().positive()]).transform(String) }),
}).passthrough();

export type DatosCancelarSuscripcion = z.infer<typeof esquemaCancelarSuscripcion>;
