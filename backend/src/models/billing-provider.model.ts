/** @archivo billing-provider.model.ts @descripcion Contratos futuros; no activan cobros ni reemplazan suscripciones existentes. */
export type BillingProviderKind = 'mercadopago' | 'google_play' | 'apple';
export type CompanyCommercialPlan = 'FREE' | 'BUSINESS' | 'BUSINESS_PRO' | 'ENTERPRISE';
export type ProfessionalCommercialPlan = 'FREE' | 'PRO' | 'PRO_PLUS';
/** Producto digital y moneda definidos en servidor o catalogo del proveedor. */
export interface BillingProduct {
  internalPlan: CompanyCommercialPlan | ProfessionalCommercialPlan;
  audience: 'empresa' | 'profesional'; provider: BillingProviderKind; providerProductId: string;
  interval: 'month' | 'year';
}
/** Prueba de compra sin confiar en importes, rol ni entitlements del cliente. */
export type PurchaseProof =
  | { provider: 'mercadopago'; preapprovalId: string }
  | { provider: 'google_play'; purchaseToken: string; packageName: string }
  | { provider: 'apple'; signedTransaction: string };
/** Solo un adaptador servidor validado contra proveedor puede producir este estado. */
export interface VerifiedBillingSubscription {
  provider: BillingProviderKind; providerSubscriptionId: string; productId: string;
  accountBinding: string; status: 'active' | 'pending' | 'grace_period' | 'on_hold' | 'canceled' | 'expired' | 'revoked';
  currentPeriodEnd: string; autoRenew: boolean; verifiedAt: string; environment: 'sandbox' | 'production';
}
/** Puerto para implementaciones posteriores; tokens/JWS no deben registrarse en logs ni analytics. */
export interface SubscriptionBillingProvider {
  readonly kind: BillingProviderKind;
  /** Verifica firma/estado/producto/entorno y vinculacion de cuenta en el backend. */
  verify(proof: PurchaseProof): Promise<VerifiedBillingSubscription>;
  /** Recibe cuerpo original y cabeceras para validar autenticidad y deduplicar por evento. */
  notification(rawBody: Uint8Array, headers: Readonly<Record<string, string>>): Promise<{
    eventId: string; subscription: VerifiedBillingSubscription;
  }>;
}
/** Comision separada del pricing y del abono digital; no se calcula hasta contratar. */
export interface TransactionFeePolicy {
  version: string; currency: string; basisPoints: number; fixedMinorUnits: number;
  chargedTo: 'company' | 'professional' | 'split'; effectiveFrom: string;
}
