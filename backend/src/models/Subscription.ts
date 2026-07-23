/**
 * @archivo Subscription.ts
 * @descripcion Modelo de datos para suscripciones SaaS de OfiAI.
 * Gestiona los planes de pago de empresas y profesionales en la plataforma.
 * @modulo Modelos
 */
export type PlanSuscripcion = 'basico' | 'pro' | 'enterprise';
export type EstadoSuscripcion = 'activa' | 'vencida' | 'cancelada' | 'trial';

export interface Suscripcion {
  id: string;
  usuarioId: string;
  rolUsuario: 'empresa' | 'profesional';
  plan: PlanSuscripcion;
  estado: EstadoSuscripcion;
  stripeCustomerId?: string;      // ID del cliente en Stripe
  stripeSubscriptionId?: string;  // ID de la suscripción en Stripe
  stripePriceId?: string;
  precioMensual: number;
  moneda: string;
  fechaInicio: Date;
  fechaVencimiento: Date;
  renovacionAutomatica: boolean;
  // Límites del plan
  limitesActuales: {
    trabajosPublicados?: number;   // Para empresas
    propuestasEnviadas?: number;   // Para profesionales
    consultasIA: number;           // Consultas a Gemini API por mes
    perfilesVisibles: number;      // Perfiles accesibles en búsqueda
  };
  fechaCreacion: Date;
  fechaActualizacion: Date;
  // TODO: Agregar historial de facturas
  // TODO: Agregar cupones y descuentos
}
