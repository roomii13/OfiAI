/**
 * @archivo subscription.model.ts
 * @descripcion Tipos de aplicación para el módulo de suscripciones de OfiAI.
 * Reexporta el modelo principal y agrega estructuras de checkout, historial y webhooks.
 * @modulo Models
 */

import { EstadoSuscripcion, PlanSuscripcion, Suscripcion } from './Subscription';

export type SubscriptionModel = Suscripcion;
export type SubscriptionPlan = PlanSuscripcion;
export type SubscriptionStatus = EstadoSuscripcion;

export interface CheckoutSuscripcion {
  proveedor: 'mercado_pago' | 'interno';
  id?: string;
  url?: string;
  requierePagoExterno: boolean;
  estado: 'creado' | 'configuracion_pendiente' | 'no_requiere_pago';
}

export interface HistorialSuscripcion {
  id: string;
  suscripcionId: string;
  usuarioId: string;
  evento: string;
  descripcion: string;
  fecha: Date;
  metadata?: Record<string, string | number | boolean>;
}

export interface ResultadoCheckoutSuscripcion {
  suscripcion: Suscripcion;
  checkout: CheckoutSuscripcion;
}
