/** @archivo protected-contract.validator.ts @descripcion Entradas estrictas: nunca identidad, estados ni totales arbitrarios. */
import { z } from 'zod';
import { CURRENCY_DIGITS } from '../constants/protected-payments';
export const contractIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const minor = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const text = z.string().trim().min(10).max(2000);
const base = { revision: z.number().int().positive(), idempotencyKey: z.string().uuid() };
export const contractCommandSchema = z.discriminatedUnion('action', [
  z.object({ ...base, action: z.literal('accept_terms'), termsVersion: z.string().min(1).max(100), acknowledge: z.literal(true) }).strict(),
  z.object({ ...base, action: z.literal('open_dispute'), reason: text }).strict(),
  z.object({ ...base, action: z.literal('message'), text }).strict(),
  z.object({ ...base, action: z.literal('appeal'), reason: text }).strict(),
  z.object({ ...base, action: z.literal('assign'), uid: contractIdSchema, reason: text }).strict(),
  z.object({ ...base, action: z.literal('propose'), kind: z.enum(['FULL_PAYMENT','CORRECTION','PARTIAL_REFUND','FULL_REFUND','MORE_INFORMATION','ESCALATE']), reason: text, refundMinor: minor }).strict(),
  z.object({ ...base, action: z.literal('approve_resolution'), resolutionId: z.string().uuid(), reason: text }).strict(),
]);
export type ContractCommand = z.infer<typeof contractCommandSchema>;
export const contractPolicySchema = z.object({
  version: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/), currency: z.string().regex(/^[A-Z]{3}$/), minorDigits: z.number().int().min(0).max(3),
  commissionBps: z.number().int().min(0).max(10000), categoryBps: z.record(z.string().min(1).max(100), z.number().int().min(0).max(10000)),
  processorBps: z.number().int().min(0).max(3000), processorFixedMinor: minor,
  processorTaxBps: z.number().int().min(0).max(10000), platformTaxBps: z.number().int().min(0).max(10000),
  withholdingBps: z.number().int().min(0).max(2000), providerChargesVerified: z.boolean(),
  termsVersion: z.string().min(1).max(100), dualApprovalMinor: minor,
}).strict().refine(value => CURRENCY_DIGITS[value.currency] === value.minorDigits, 'Moneda no admitida.');
export const financialGrantSchema = z.object({
  uid: contractIdSchema, active: z.boolean(), permissions: z.array(z.enum(['view','communicate','propose','resolve','finance'])).max(5),
  limitsMinor: z.record(z.string().regex(/^[A-Z]{3}$/), minor), reason: text,
}).strict();
