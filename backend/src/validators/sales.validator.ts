/** @archivo sales.validator.ts @descripcion Limites y entradas explicitas del CRM. */
import { z } from 'zod';
import { redactSecrets } from '../utils/agent-text';
export const salesIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
export const salesInputSchema = z.object({
  need: z.string().trim().min(3).max(2000).transform(redactSecrets), expectedMonthlyVolume: z.number().int().min(0).max(100000),
  consent: z.boolean(),
}).strict();
export const salesAdminSchema = z.object({
  version: z.number().int().positive(),
  action: z.enum(['qualify', 'contact', 'interested', 'trial', 'lost', 'recover', 'sync']),
}).strict();
export const salesReplySchema = z.object({ message: z.string().trim().min(1).max(2000).transform(redactSecrets) }).strict();
