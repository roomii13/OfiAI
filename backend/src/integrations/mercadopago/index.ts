/**
 * @archivo index.ts
 * @descripcion Integración HTTP con Mercado Pago para suscripciones SaaS de OfiAI.
 * Crea preapprovals mensuales, cancela suscripciones y consulta eventos de pago sin SDK externo.
 * @modulo Integrations
 */

import crypto from 'crypto';
import { env } from '../../config/env';

const MERCADO_PAGO_API_URL = 'https://api.mercadopago.com';

export interface CrearPreapprovalMercadoPagoParams {
  payerEmail: string;
  reason: string;
  amount: number;
  currency: string;
  backUrl: string;
  notificationUrl?: string;
  usuarioId: string;
  suscripcionId: string;
  plan: string;
}

export interface PreapprovalMercadoPagoCreado {
  id: string;
  initPoint?: string;
  sandboxInitPoint?: string;
}

export interface WebhookMercadoPago {
  id?: string | number;
  type?: string;
  action?: string;
  data?: {
    id?: string;
  };
}

export interface PreapprovalMercadoPago {
  id: string;
  status: string;
  external_reference?: string;
  payer_email?: string;
}

export interface PagoMercadoPago {
  id: number;
  status: string;
  external_reference?: string;
  metadata?: {
    suscripcion_id?: string;
    suscripcionId?: string;
    usuario_id?: string;
    usuarioId?: string;
    plan?: string;
  };
}

/**
 * Indica si Mercado Pago tiene credenciales mínimas para operar.
 */
export const mercadoPagoDisponible = (): boolean => Boolean(env.MERCADOPAGO_ACCESS_TOKEN);

/**
 * Crea una preaprobación mensual en Mercado Pago.
 */
export const crearPreapprovalMercadoPago = async (
  params: CrearPreapprovalMercadoPagoParams
): Promise<PreapprovalMercadoPagoCreado> => {
  const respuesta = await mercadoPagoRequest<PreapprovalMercadoPagoCreado>('/preapproval', {
    method: 'POST',
    body: {
      reason: params.reason,
      payer_email: params.payerEmail,
      back_url: params.backUrl,
      external_reference: params.suscripcionId,
      notification_url: params.notificationUrl,
      metadata: {
        usuarioId: params.usuarioId,
        suscripcionId: params.suscripcionId,
        plan: params.plan,
      },
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: params.amount,
        currency_id: params.currency,
      },
    },
  });

  return {
    id: respuesta.id,
    initPoint: respuesta.initPoint ?? (respuesta as unknown as { init_point?: string }).init_point,
    sandboxInitPoint: respuesta.sandboxInitPoint ?? (respuesta as unknown as { sandbox_init_point?: string }).sandbox_init_point,
  };
};

/**
 * Cancela una preaprobación activa en Mercado Pago.
 */
export const cancelarPreapprovalMercadoPago = async (preapprovalId: string): Promise<void> => {
  await mercadoPagoRequest(`/preapproval/${preapprovalId}`, {
    method: 'PUT',
    body: { status: 'cancelled' },
  });
};

/**
 * Consulta una preaprobación por ID.
 */
export const obtenerPreapprovalMercadoPago = async (preapprovalId: string): Promise<PreapprovalMercadoPago> => {
  return mercadoPagoRequest<PreapprovalMercadoPago>(`/preapproval/${preapprovalId}`, {
    method: 'GET',
  });
};

/**
 * Consulta un pago por ID.
 */
export const obtenerPagoMercadoPago = async (paymentId: string): Promise<PagoMercadoPago> => {
  return mercadoPagoRequest<PagoMercadoPago>(`/v1/payments/${paymentId}`, {
    method: 'GET',
  });
};

/**
 * Valida firma de webhook cuando MERCADOPAGO_WEBHOOK_SECRET está configurado.
 */
export const validarFirmaMercadoPago = (
  xSignature: string | undefined,
  xRequestId: string | undefined,
  dataId: string | undefined
): boolean => {
  if (!env.MERCADOPAGO_WEBHOOK_SECRET) {
    return true;
  }

  if (!xSignature || !xRequestId || !dataId) {
    return false;
  }

  const firma = xSignature
    .split(',')
    .map((parte) => parte.trim().split('='))
    .find(([clave]) => clave === 'v1')?.[1];

  if (!firma) {
    return false;
  }

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${extraerTimestampFirma(xSignature)};`;
  const expected = crypto
    .createHmac('sha256', env.MERCADOPAGO_WEBHOOK_SECRET)
    .update(manifest)
    .digest('hex');

  if (expected.length !== firma.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(firma));
};

interface MercadoPagoRequestOptions {
  method: 'GET' | 'POST' | 'PUT';
  body?: Record<string, unknown>;
}

/**
 * Ejecuta una solicitud autenticada contra la API de Mercado Pago.
 */
const mercadoPagoRequest = async <T>(
  path: string,
  options: MercadoPagoRequestOptions
): Promise<T> => {
  if (!mercadoPagoDisponible()) {
    throw new Error('Mercado Pago no está configurado. Define MERCADOPAGO_ACCESS_TOKEN.');
  }

  const response = await fetch(`${MERCADO_PAGO_API_URL}${path}`, {
    method: options.method,
    headers: {
      Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof data === 'object' && data && 'message' in data
      ? String((data as { message: unknown }).message)
      : 'Error desconocido de Mercado Pago.';
    throw new Error(`Mercado Pago respondió ${response.status}: ${message}`);
  }

  return data as T;
};

/**
 * Extrae el timestamp enviado en x-signature.
 */
const extraerTimestampFirma = (xSignature: string): string => {
  return xSignature
    .split(',')
    .map((parte) => parte.trim().split('='))
    .find(([clave]) => clave === 'ts')?.[1] ?? '';
};
