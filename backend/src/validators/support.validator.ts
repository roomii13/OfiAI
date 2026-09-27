/** @archivo support.validator.ts @descripcion Entradas de soporte y redaccion defensiva de secretos. */
import { z } from 'zod';
import { salesIdSchema } from './sales.validator';
import { redactSecrets } from '../utils/agent-text';
export { redactSecrets } from '../utils/agent-text';
export const supportResourceSchema = z.object({ tool: z.enum(['getJob','getSubscription','getInvoice','getProfessional']),
  id: salesIdSchema.optional() }).strict();
export const supportStartSchema = z.object({ resource: supportResourceSchema.nullable().default(null) }).strict();
export const supportMessageSchema = z.object({ message: z.string().trim().min(1).max(4000).transform(redactSecrets),
  version: z.number().int().positive(), requestId: z.string().uuid() }).strict();
export const ticketCommandSchema = z.object({ version: z.number().int().positive(),
  action: z.enum(['claim','reply','resolve']), message: z.string().trim().min(1).max(4000).transform(redactSecrets).optional() }).strict();
