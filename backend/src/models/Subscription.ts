/**
 * @archivo Subscription.ts
 * @descripcion Modelo de datos para suscripciones SaaS de OfiAI.
 * Gestiona los planes de pago de empresas y profesionales en la plataforma.
 * @modulo Modelos
 */
export type PlanSuscripcion = import('../../../shared/billing').BillingPlanId;
export type EstadoSuscripcion = 'activa' | 'vencida' | 'cancelada' | 'trial' | 'pendiente_pago';

export interface Suscripcion {
  id: string;
  usuarioId: string;
  rolUsuario: 'empresa' | 'profesional';
  plan: PlanSuscripcion;
  estado: EstadoSuscripcion;
  mercadoPagoPreapprovalId?: string;
  mercadoPagoPreferenceId?: string;
  mercadoPagoPaymentId?: string;
  precioMensual: number;
  moneda: string;
  fechaInicio: Date;
  fechaVencimiento: Date;
  renovacionAutomatica: boolean;
  catalogVersion?: string;
  priceUsd?: number;
  exchangeRate?: import('../../../shared/billing').BillingExchangeRate;
  checkoutUrl?: string;
  checkoutAttempted?: boolean;
  providerStatus?: string;
  cancelAtPeriodEnd?: boolean;
  pendingPlan?: { plan: PlanSuscripcion; precioMensual: number; priceUsd: number;
    limits: import('../../../shared/billing').BillingLimits; effectiveAt: string;
    exchangeRate?: import('../../../shared/billing').BillingExchangeRate } | null;
  lastPaidAt?: string;
  limitesActuales: {
    trabajosPublicados?: number;
    propuestasEnviadas?: number;
    consultasIA: number;
    perfilesVisibles: number;
  };
  fechaCreacion: Date;
  fechaActualizacion: Date;
}
