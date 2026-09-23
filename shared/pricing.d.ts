/** @archivo pricing.d.ts @descripcion Contratos de pricing sin dependencias de plataforma. */
import type { MatchingJob } from './matching';
export type PricingUnit = 'hour' | 'm2' | 'unit' | 'job';
export type CostCoverage = 'included' | 'excluded' | 'unknown';
export interface PricingInputs {
  currency: string; scope: string; unit: PricingUnit; quantity: number;
  materials: CostCoverage; materialsCost: number | null; taxes: CostCoverage;
  requiredExperienceYears: number | null;
}
export interface PricingQuote extends Omit<PricingInputs, 'materialsCost' | 'requiredExperienceYears'> {
  id: string; label: string; amount: number; validUntil: string;
}
export interface PricingEvidence {
  id: string; source: 'quote' | 'history' | 'rate'; amount: number; currency: string;
  scope: string; unit: PricingUnit; quantity: number; materials: CostCoverage; taxes: CostCoverage;
  date: string; expiresAt: string | null;
}
export interface QuoteComparison {
  id: string; label: string; amount: number; currency: string; comparable: boolean;
  normalizedAmount: number | null; deviationPercent: number | null;
  flag: 'low' | 'high' | 'normal' | 'unverified'; explanation: string;
}
export interface PricingEstimate {
  id: string; version: string; generatedAt: string; expiresAt: string;
  status: 'estimated' | 'insufficient_data';
  currency: string; range: { min: number; max: number; central: number } | null;
  basis: 'quote' | 'history' | 'rate' | null; confidence: number;
  confidenceLevel: 'low' | 'medium' | 'high'; missingInformation: string[];
  factors: string[]; warnings: string[]; evidenceCount: number;
  comparisons: QuoteComparison[]; semanticUsed: boolean; fallbackUsed: boolean;
  analysis: string | null; assumptions: string[]; evidence: PricingEvidence[];
}
export interface PricingHistoryItem {
  id: string; generatedAt: string; status: PricingEstimate['status'];
  currency: string; range: PricingEstimate['range']; confidence: number;
}
export interface PricingView {
  jobId: string; job: MatchingJob; inputs: PricingInputs | null; revision: number;
  quotes: PricingQuote[]; result: PricingEstimate | null; stale: boolean; processing: boolean;
  history: PricingHistoryItem[]; nextStep: 'pricing_required' | 'professional_selection' | 'coordinator_pending';
}
