/** @archivo marketing.validator.ts @descripcion Rechaza metricas inconsistentes y segmentacion arbitraria. */
import { z } from 'zod';
import { redactSecrets } from './support.validator';
export const campaignContentSchema=z.object({version:z.number().int().positive(),variants:z.array(z.object({
  id:z.enum(['A','B']),title:z.string().trim().min(3).max(120).transform(redactSecrets),
  body:z.string().trim().min(10).max(1500).transform(redactSecrets),cta:z.string().trim().min(3).max(100).transform(redactSecrets),
}).strict()).length(2)}).strict().refine(value=>new Set(value.variants.map(variant=>variant.id)).size===2,'Variantes duplicadas.');
export const campaignSchema = z.object({
  name: z.string().trim().min(3).max(100), objective: z.enum(['activacion','retencion','recuperacion']),
  audience: z.enum(['empresa','profesional']), channel: z.enum(['in_app','email','social','landing','seo']),
  stages: z.array(z.enum(['LEAD','QUALIFIED','CONTACTED','INTERESTED','TRIAL','CUSTOMER','LOST'])).min(1).max(7),
  currency: z.string().regex(/^[A-Z]{3}$/), hypothesis: z.string().trim().min(5).max(1000),
}).strict();
export const campaignActionSchema = z.object({ version: z.number().int().positive(),
  action: z.enum(['approve','pause','dispatch']) }).strict();
const count = z.number().int().min(0).max(1000000000);
export const marketingReportSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{3,100}$/), variantId: z.enum(['A','B']),
  source: z.string().trim().min(3).max(200), period: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),
  currency: z.string().regex(/^[A-Z]{3}$/), impressions: count, clicks: count, conversions: count,
  acquiredCustomers: count, spendMinor: count, attributedRevenueMinor: count, activeAtStart: count, retained: count, churned: count,
}).strict().refine(value => value.clicks <= value.impressions && value.conversions <= value.clicks
  && value.acquiredCustomers <= value.conversions && value.retained + value.churned <= value.activeAtStart,
'Las cantidades no son coherentes.');
