/**
 * @archivo matching.validator.ts
 * @descripcion Validacion estricta de parametros y salida semantica de Gemini.
 */
import { z } from 'zod';
export const matchingIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const matchingCommandSchema = z.object({}).strict();
export const matchingSelectionSchema = z.object({ runId: z.string().uuid() }).strict();
export const matchingViewSchema = z.object({ type: z.literal('match_viewed'), runId: z.string().uuid() }).strict();
/** Valida IDs, rangos y longitud; el agente tambien verifica pertenencia y duplicados. */
export const semanticMatchesSchema = z.object({
  matches: z.array(z.object({
    professionalId: matchingIdSchema, semanticScore: z.number().finite().min(0).max(100),
    reason: z.string().trim().min(1).max(600),
    strengths: z.array(z.string().trim().min(1).max(240)).max(6),
    concerns: z.array(z.string().trim().min(1).max(240)).max(6),
    recommended: z.boolean(),
  }).strict()).max(20),
}).strict();
export type SemanticMatch = z.infer<typeof semanticMatchesSchema>['matches'][number];

