/** @archivo coordinator.validator.ts @descripcion Comandos estrictos, importes explicitos y fechas con zona horaria. */
import { z } from 'zod';
import { pricingQuoteSchema } from './pricing.validator';
const key = z.string().uuid();
export const coordinatorStartSchema = z.object({ idempotencyKey: key, acknowledgeEstimate: z.literal(true) }).strict();
export const coordinatorCommandSchema = z.object({
  workflowId: key,
  revision: z.number().int().min(1).max(10000), idempotencyKey: key,
  action: z.enum(['contact', 'respond', 'request_quote', 'submit_quote', 'review_quote', 'counter_offer',
    'accept_quote', 'propose_schedule', 'confirm_schedule', 'start_work', 'request_completion', 'complete', 'cancel']),
  quote: pricingQuoteSchema.optional(),
  schedule: z.object({ startsAt: z.string().datetime({ offset: true }), endsAt: z.string().datetime({ offset: true }) }).strict().optional(),
  note: z.string().trim().min(3).max(500).optional(),
}).strict().superRefine((v, ctx) => {
  if (Boolean(v.quote) !== ['submit_quote', 'counter_offer'].includes(v.action))
    ctx.addIssue({ code: 'custom', path: ['quote'], message: 'Presupuesto incompatible con la accion.' });
  if (Boolean(v.schedule) !== (v.action === 'propose_schedule'))
    ctx.addIssue({ code: 'custom', path: ['schedule'], message: 'Horario incompatible con la accion.' });
  if (v.action === 'cancel' && !v.note) ctx.addIssue({ code: 'custom', path: ['note'], message: 'Indica el motivo.' });
});
export const coordinatorQuerySchema = z.object({ cursor: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/).optional() }).strict();
