/** @archivo billing.d.ts @descripcion Contratos comerciales publicos, sin secretos ni datos de tarjetas. */
export type BillingPlanId = 'gratuito' | 'profesional' | 'empresa' | 'business_pro' | 'enterprise' | 'pro_plus';
export type BillingAudience = 'empresa' | 'profesional';
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
