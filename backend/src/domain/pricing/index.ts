/**
 * @archivo domain/pricing/index.ts
 * @dominio Pricing
 * @descripcion Dominio de pricing en OfiAI.
 */
export type {
  EntradaEstimacionPrecio,
  ResultadoEstimacionPrecio,
} from '../../ai/agents/pricing.agent';
export { pricingAgent } from '../../ai/agents/pricing.agent';
export type { PricingInputs, PricingEvidence, PricingEstimate, PricingView } from '../../models/pricing.model';
export { calculatePricing } from '../../ai/tools/pricing.tool';
