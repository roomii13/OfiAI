/** @archivo pricing.model.ts @descripcion Entidades internas de pricing y evidencia auditable. */
export type * from '../../../shared/pricing';
import type { PricingInputs, PricingQuote, PricingEstimate, PricingEvidence } from '../../../shared/pricing';
import type { Trabajo } from './Job';
export interface PricingContext { inputs: PricingInputs | null; revision: number; quoteCount: number }
export interface PricingRun {
  id: string; fingerprint: string; status: 'processing' | 'completed' | 'failed';
  leaseUntil: number; startedAt: string; result: PricingEstimate | null;
}
export interface PricingSnapshot { context: PricingContext; quotes: PricingQuote[]; run: PricingRun | null }
export interface PricingAudit { job: Trabajo; inputs: PricingInputs | null; evidence: PricingEvidence[]; result: PricingEstimate; fingerprint: string; revision: number }
