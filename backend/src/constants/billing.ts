/** @archivo billing.ts @descripcion Catalogo mensual versionado y configuracion comercial validada. */
import { z } from 'zod';
import type { BillingAudience, BillingLimits, BillingPlanId } from '../../../shared/billing';

export const BILLING_CATALOG_VERSION = '2026-09-26';
export const billingPlanSchema = z.enum(['gratuito', 'profesional', 'empresa', 'business_pro', 'enterprise', 'pro_plus']);
const quota = z.number().int().min(-1).max(1000000);
export const billingLimitsSchema = z.object({
  trabajosPublicados: quota, propuestasEnviadas: quota, consultasIA: quota, perfilesVisibles: quota,
}).strict();
export const billingOverridesSchema = z.object({
  empresa: z.object({ priceUsd: z.number().min(35).max(100000), limits: billingLimitsSchema }).strict().optional(),
  profesional: z.object({ priceUsd: z.number().min(35).max(100000), limits: billingLimitsSchema }).strict().optional(),
  business_pro: z.object({ priceUsd: z.number().min(35).max(100000), limits: billingLimitsSchema }).strict().optional(),
  enterprise: z.object({ priceUsd: z.number().min(35).max(100000), limits: billingLimitsSchema }).strict().optional(),
  pro_plus: z.object({ priceUsd: z.number().min(35).max(100000), limits: billingLimitsSchema }).strict().optional(),
}).strict();
export const storeProductsSchema = z.array(z.object({
  provider: z.enum(['google_play', 'apple']), plan: billingPlanSchema.exclude(['gratuito']),
  productId: z.string().regex(/^[a-zA-Z0-9._-]{3,160}$/), audience: z.enum(['empresa', 'profesional']),
}).strict()).max(40);

/** Valores centralizados; -1 representa una cuota sin limite. */
function limits(jobs: number, proposals: number, ai: number, profiles: number): BillingLimits {
  return { trabajosPublicados: jobs, propuestasEnviadas: proposals, consultasIA: ai, perfilesVisibles: profiles };
}
export const COMMERCIAL_PLANS: ReadonlyArray<{
  id: BillingPlanId; nombre: string; audience: BillingAudience; priceUsd: number; limits: BillingLimits;
}> = [
  { id: 'gratuito', nombre: 'FREE', audience: 'empresa', priceUsd: 0, limits: limits(1, 0, 5, 5) },
  { id: 'empresa', nombre: 'BUSINESS', audience: 'empresa', priceUsd: 35, limits: limits(10, 0, 50, 100) },
  { id: 'business_pro', nombre: 'BUSINESS PRO', audience: 'empresa', priceUsd: 79, limits: limits(40, 0, 200, 500) },
  { id: 'enterprise', nombre: 'ENTERPRISE', audience: 'empresa', priceUsd: 149, limits: limits(-1, 0, 500, -1) },
  { id: 'gratuito', nombre: 'FREE', audience: 'profesional', priceUsd: 0, limits: limits(0, 3, 5, 5) },
  { id: 'profesional', nombre: 'PRO', audience: 'profesional', priceUsd: 35, limits: limits(0, 50, 50, 40) },
  { id: 'pro_plus', nombre: 'PRO+', audience: 'profesional', priceUsd: 59, limits: limits(0, -1, 150, 100) },
];
