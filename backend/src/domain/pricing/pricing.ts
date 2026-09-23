/** @archivo pricing.ts @descripcion Huellas de requisitos, version y referencias de precio. */
import { createHash } from 'node:crypto';
import { matchingJobFingerprint } from '../matching/matching';
import { PRICING_POLICY } from '../../constants/pricing';
import { PRICING_PROMPT_VERSION } from '../../ai/prompts/pricing.prompt';
import { env } from '../../config/env';
import type { Trabajo } from '../../models/Job';
import type { PricingSnapshot, PricingEvidence } from '../../models/pricing.model';
/** Incluye las referencias efectivas; cambios de tarifas y presupuestos invalidan el cache. */
export function pricingFingerprint(job: Trabajo, snapshot: PricingSnapshot, evidence: PricingEvidence[]): string {
  return createHash('sha256').update(JSON.stringify({ job: matchingJobFingerprint(job), selection: job.matchingSelection ?? null,
    context: snapshot.context, quotes: snapshot.quotes, evidence: [...evidence].sort((a, b) => a.id.localeCompare(b.id)),
    policy: PRICING_POLICY, prompt: PRICING_PROMPT_VERSION, model: env.GEMINI_PRICING_MODEL, enabled: env.GEMINI_PRICING_ENABLED })).digest('hex');
}
/** Convierte Timestamp/Date/ISO sin aceptar fechas invalidas como actuales. */
export function pricingDate(value: unknown): string | null {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return pricingDate(value.toDate());
  const date = Object.prototype.toString.call(value) === '[object Date]' ? new Date(Number(value)) : typeof value === 'string' ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
