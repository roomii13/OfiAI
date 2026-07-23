/**
 * @archivo subscription.validator.ts
 * @descripcion Esquemas de validación para suscripciones SaaS de OfiAI.
 * @modulo Validators
 */
import { z } from 'zod';

export const esquemaSuscribirse = z.object({
  plan: z.enum(['basico', 'pro', 'enterprise']),
  // TODO: Agregar método de pago (Stripe token)
  // TODO: Agregar código de cupón opcional
});

export type DatosSuscribirse = z.infer<typeof esquemaSuscribirse>;
