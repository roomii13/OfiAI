/** @archivo pricing.validator.ts @descripcion Limites estrictos y contratos de entradas/precios/IA. */
import { z } from 'zod';
const coverage = z.enum(['included', 'excluded', 'unknown']);
const currency = z.string().regex(/^[A-Z]{3}$/);
const unit = z.enum(['hour', 'm2', 'unit', 'job']);
const scope = z.string().trim().min(8).max(400);
const quantity = z.number().finite().positive().max(100000);
const amount = z.number().finite().positive().max(1000000000);
const terms = { currency, scope, unit, quantity, materials: coverage, taxes: coverage };
export const pricingInputsSchema = z.object({ ...terms,
  materialsCost: z.number().finite().min(0).max(1000000000).nullable(),
  requiredExperienceYears: z.number().int().min(0).max(60).nullable(),
}).strict().superRefine((v, ctx) => {
  if (v.materials !== 'excluded' && v.materialsCost !== null) ctx.addIssue({ code: 'custom', path: ['materialsCost'], message: 'El costo separado requiere materiales excluidos.' });
  if (v.unit === 'job' && v.quantity !== 1) ctx.addIssue({ code: 'custom', path: ['quantity'], message: 'Un trabajo completo requiere cantidad 1.' });
});
export const pricingQuoteSchema = z.object({ ...terms, id: z.string().regex(/^[a-zA-Z0-9_-]{16,64}$/),
  label: z.string().trim().min(2).max(100), amount,
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 'Fecha invalida'),
}).strict().refine(v => v.unit !== 'job' || v.quantity === 1, 'Un trabajo completo requiere cantidad 1.');
export const pricingInputCommand = z.object({ revision: z.number().int().nonnegative(), inputs: pricingInputsSchema }).strict();
export const pricingQuoteCommand = z.object({ revision: z.number().int().nonnegative(), quote: pricingQuoteSchema }).strict();
export const pricingCommand = z.object({}).strict();
export const pricingSemanticSchema = z.object({
  summary: z.string().min(10).max(700), evidenceIds: z.array(z.string().min(1).max(150)).max(100),
  questions: z.array(z.string().min(5).max(200)).max(5),
  cautions: z.array(z.string().min(5).max(200)).max(5),
}).strict();
