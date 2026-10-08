/** @archivo billing.d.ts @descripcion Contratos comerciales publicos, sin secretos ni datos de tarjetas. */
export type BillingPlanId = 'gratuito' | 'profesional' | 'empresa' | 'business_pro' | 'enterprise' | 'pro_plus';
export type BillingAudience = 'empresa' | 'profesional' | 'particular';
/** Desglose acordado; no representa un cobro ni un deposito en custodia. */
export interface ContractCharges {
  policyVersion: string; quoteId: string; currency: string; basisPoints: number;
  professionalAmountMinor: number; feeMinor: number; contractorTotalMinor: number;
  payer: 'contractor'; collectionEnabled: false; protectionEnabled: false;
}
/** Cotizacion publica aplicada al importe del plan; nunca contiene credenciales. */
export interface BillingExchangeRate {
  source: 'mercadopago' | 'manual';
  base: 'USD';
  quote: 'ARS';
  rate: number;
  asOf: string;
}
export interface BillingLimits {
  trabajosPublicados: number;
  propuestasEnviadas: number;
  consultasIA: number;
  perfilesVisibles: number;
}
export interface CommercialPlan {
  id: BillingPlanId;
  nombre: string;
  audience: BillingAudience;
  priceUsd: number;
  precioMensual: number | null;
  moneda: string;
  available: boolean;
  exchangeRate?: BillingExchangeRate;
  limits: BillingLimits;
  limitesEmpresa: Record<string, number>;
  limitesProfesional: Record<string, number>;
}
export interface BillingEntitlements {
  plan: BillingPlanId;
  paid: boolean;
  period: string;
  limits: BillingLimits;
  used: Partial<BillingLimits>;
  features: { publishJobs: boolean; sendProposals: boolean; financialHistory: boolean };
}
export interface BillingPayment {
  id: string;
  subscriptionId: string;
  amountMinor: number;
  refundedMinor: number;
  currency: string;
  status: 'approved' | 'refunded' | 'charged_back';
  paidAt: string;
  periodEnd: string;
}
export interface BillingStoreProduct {
  provider: 'google_play' | 'apple';
  plan: Exclude<BillingPlanId, 'gratuito'>;
  productId: string;
  audience: BillingAudience;
}
export interface BillingOverview {
  pendingCheckout: { id: string; plan: BillingPlanId } | null;
  entitlements: BillingEntitlements;
  payments: BillingPayment[];
  stores: { products: BillingStoreProduct[]; purchasesEnabled: false };
  transactionFee: { configured: boolean; basisPoints: number | null; collectionEnabled: false };
}
