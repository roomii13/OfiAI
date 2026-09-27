/** @archivo knowledge.validator.ts @descripcion Memoria explicita, acotada y sin secretos. */
import { z } from 'zod';
import { redactSecrets } from './support.validator';
import { salesIdSchema } from './sales.validator';
export const knowledgeScopeSchema = z.enum(['private','organization','job','platform']);
export const knowledgeInputSchema = z.object({
  scope: knowledgeScopeSchema, jobId: salesIdSchema.optional(), title: z.string().trim().min(3).max(140).transform(redactSecrets),
  text: z.string().trim().min(3).max(8000).transform(redactSecrets),
  kind: z.enum(['preference','policy','history','procedure','documentation']),
  consent: z.literal(true), retentionDays: z.number().int().min(1).max(365),
  published: z.boolean().default(false),
}).strict();
export const knowledgeQuerySchema = z.object({
  scope: knowledgeScopeSchema, jobId: salesIdSchema.optional(), query: z.string().trim().min(2).max(500).transform(redactSecrets),
}).strict();
