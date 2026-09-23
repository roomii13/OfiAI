/**
 * @archivo index.ts
 * @descripcion Exportaciones del dominio de suscripciones de OfiAI.
 * Agrupa tipos públicos de planes y estado para capas de aplicación e interfaz.
 * @modulo Domain
 */

export type { PlanSuscripcion, EstadoSuscripcion, Suscripcion } from '../../models/Subscription';
export type {
  CheckoutSuscripcion,
  HistorialSuscripcion,
  ResultadoCheckoutSuscripcion,
  SubscriptionModel,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../../models/subscription.model';
/** Contratos para nuevos canales; las implementaciones comerciales existentes no se modifican. */
export type { BillingProviderKind, BillingProduct, SubscriptionBillingProvider, VerifiedBillingSubscription, TransactionFeePolicy } from '../../models/billing-provider.model';
