/**
 * @archivo Subscription.ts
 * @descripcion Modelo de datos para suscripciones SaaS de OfiAI.
 * Gestiona los planes de pago de empresas y profesionales en la plataforma.
 * @modulo Modelos
 */
export type PlanSuscripcion = 'gratuito' | 'profesional' | 'empresa';
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
  limitesActuales: {
    trabajosPublicados?: number;
    propuestasEnviadas?: number;
    consultasIA: number;
    perfilesVisibles: number;
  };
  fechaCreacion: Date;
  fechaActualizacion: Date;
}
