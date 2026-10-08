/**
 * @archivo index.ts
 * @descripcion Integración HTTP con Mercado Pago para suscripciones SaaS de OfiAI.
 * Crea preapprovals mensuales, cancela suscripciones y consulta eventos de pago sin SDK externo.
 * @modulo Integrations
 */

import crypto from 'crypto';
import { env } from '../../config/env';
import { z } from 'zod';
import { ApiError } from '../../middleware/error.middleware';

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
  init_point?: string;
  auto_recurring?: { transaction_amount: number; currency_id: string };
}

export interface PagoMercadoPago {
  id: number;
  status: string;
  transaction_amount: number;
  transaction_amount_refunded?: number;
  currency_id: string;
  date_approved?: string | null;
  live_mode?: boolean;
  external_reference?: string;
  metadata?: {
    suscripcion_id?: string;
    suscripcionId?: string;
    usuario_id?: string;
    usuarioId?: string;
    plan?: string;
  };
}

const providerId = z.union([z.string().regex(/^[a-zA-Z0-9_-]{1,160}$/), z.number().int().nonnegative()]).transform(String);
const preapprovalSchema = z.object({
  id: providerId, status: z.string(), external_reference: z.string().optional(),
  init_point: z.string().url().optional(), payer_email: z.string().optional(),
  auto_recurring: z.object({ transaction_amount: z.number().nonnegative(), currency_id: z.string() }).optional(),
});
const paymentSchema = z.object({
  id: z.number().int().positive(), status: z.string(), transaction_amount: z.number().nonnegative(),
  transaction_amount_refunded: z.number().nonnegative().optional(), currency_id: z.string(),
  date_approved: z.string().datetime({ offset: true }).nullable().optional(), live_mode: z.boolean().optional(),
  external_reference: z.string().nullable().optional(),
});
const invoiceSchema = z.object({
  id: providerId, preapproval_id: providerId, debit_date: z.string().datetime({ offset: true }),
  currency_id: z.string(), transaction_amount: z.coerce.number().positive(),
  payment: z.object({ id: z.number().int().positive(), status: z.string() }).nullable().optional(),
});
const contractPaymentSchema = paymentSchema.extend({ collector_id: z.number().int().positive(), date_last_updated: z.string().datetime({offset:true}),
  transaction_details:z.object({ net_received_amount:z.number().nonnegative().nullable().optional() }).optional(),
});
export type ContractMercadoPagoPayment = z.infer<typeof contractPaymentSchema>;
/** Cuenta receptora derivada del token servidor, no de un ID proporcionado por React. */
export async function obtenerCuentaReceptoraMercadoPago(): Promise<string> {
  const result = z.object({ id:z.number().int().positive(),site_id:z.literal('MLA') }).parse(await mercadoPagoRequest('/users/me',{ method:'GET' }));
  return String(result.id);
}
/** Consulta de un cobro de trabajo con comisiones efectivas y cuenta receptora. */
export async function obtenerCobroTrabajoMercadoPago(id: string): Promise<ContractMercadoPagoPayment> {
  return contractPaymentSchema.parse(await mercadoPagoRequest('/v1/payments/' + providerId.parse(id),{ method:'GET' }));
}
const contractPreferenceSchema = z.object({ id:providerId,init_point:z.string().url(),collector_id:z.number().int().positive(),external_reference:z.string() });
/** Checkout normal a la cuenta del token: sin escrow, split ni transferencias automaticas. */
export async function crearCheckoutTrabajoMercadoPago(input: { reference:string; amountMinor:number; returnUrl:string; notificationUrl:string }): Promise<z.infer<typeof contractPreferenceSchema>> {
  return contractPreferenceSchema.parse(await mercadoPagoRequest('/checkout/preferences',{ method:'POST',body:{
    external_reference:input.reference,items:[{ id:input.reference,title:'Contratacion OfiAI',quantity:1,currency_id:'ARS',unit_price:input.amountMinor/100 }],
    notification_url:input.notificationUrl,back_urls:{ success:input.returnUrl,pending:input.returnUrl,failure:input.returnUrl },
    auto_return:'approved',payment_methods:{ installments:1 },expires:true,expiration_date_to:new Date(Date.now()+86400000).toISOString(),
  } }));
}
/** Recupera una preferencia tras un timeout; nunca crea otra a ciegas. */
export async function buscarCheckoutTrabajoMercadoPago(reference: string): Promise<z.infer<typeof contractPreferenceSchema> | null> {
  const rows = z.object({ elements:z.array(z.object({ id:providerId,external_reference:z.string() })) }).parse(
    await mercadoPagoRequest('/checkout/preferences/search?external_reference=' + encodeURIComponent(reference),{ method:'GET' }));
  const matches = rows.elements.filter(row=>row.external_reference===reference);
  if (matches.length>1) throw new ApiError('Existen multiples preferencias; requiere conciliacion.',409);
  if (!matches[0]) return null;
  return contractPreferenceSchema.parse(await mercadoPagoRequest('/checkout/preferences/' + matches[0].id,{ method:'GET' }));
}
export type FacturaMercadoPago = z.infer<typeof invoiceSchema>;

/**
 * Indica si Mercado Pago tiene credenciales mínimas para operar.
 */
export const mercadoPagoDisponible = (): boolean => Boolean(env.MERCADOPAGO_ACCESS_TOKEN);

/** Consulta USD/ARS sin crear pagos y valida la moneda, fecha e importe del proveedor. */
export async function obtenerCotizacionMercadoPago(): Promise<{ rate: number; asOf: string }> {
  if (!env.MERCADOPAGO_PUBLIC_KEY) throw new ApiError('La cotizacion no esta configurada.', 503);
  const query = new URLSearchParams({ from: 'USD', to: 'ARS', public_key: env.MERCADOPAGO_PUBLIC_KEY });
  const response = await mercadoPagoRequest('/v1/exchange_rates?' + query.toString(), { method: 'GET', timeoutMs: 5000 });
  const parsed = z.object({
    currency_base: z.literal('USD'), currency_quote: z.literal('ARS'),
    rate: z.number().finite().positive().max(1000000), creation_date: z.string().datetime({ offset: true }),
  }).safeParse(response);
  if (!parsed.success) throw new ApiError('El proveedor no devolvio una cotizacion valida.', 502);
  return { rate: parsed.data.rate, asOf: parsed.data.creation_date };
}

/**
 * Crea una preaprobación mensual en Mercado Pago.
 */
export const crearPreapprovalMercadoPago = async (
  params: CrearPreapprovalMercadoPagoParams
): Promise<PreapprovalMercadoPagoCreado> => {
  const respuesta = await mercadoPagoRequest<PreapprovalMercadoPagoCreado>('/preapproval', {
    method: 'POST',
    body: {
      status: 'pending',
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
    id: providerId.parse(respuesta.id),
    initPoint: respuesta.initPoint ?? (respuesta as unknown as { init_point?: string }).init_point,
    sandboxInitPoint: respuesta.sandboxInitPoint ?? (respuesta as unknown as { sandbox_init_point?: string }).sandbox_init_point,
  };
};

/**
 * Cancela una preaprobación activa en Mercado Pago.
 */
export const cancelarPreapprovalMercadoPago = async (preapprovalId: string): Promise<void> => {
  await mercadoPagoRequest(`/preapproval/${providerId.parse(preapprovalId)}`, {
    method: 'PUT',
    body: { status: 'cancelled' },
  });
};

/**
 * Consulta una preaprobación por ID.
 */
export const obtenerPreapprovalMercadoPago = async (preapprovalId: string): Promise<PreapprovalMercadoPago> => {
  return preapprovalSchema.parse(await mercadoPagoRequest(`/preapproval/${providerId.parse(preapprovalId)}`, {
    method: 'GET',
  }));
};

/**
 * Consulta un pago por ID.
 */
export const obtenerPagoMercadoPago = async (paymentId: string): Promise<PagoMercadoPago> => {
  const result = paymentSchema.parse(await mercadoPagoRequest(`/v1/payments/${providerId.parse(paymentId)}`, {
    method: 'GET',
  }));
  return { ...result, external_reference: result.external_reference ?? undefined };
};

/** Consulta la factura recurrente, cuyo ID no es el ID de payment. */
export async function obtenerFacturaMercadoPago(id: string): Promise<FacturaMercadoPago> {
  return invoiceSchema.parse(await mercadoPagoRequest(`/authorized_payments/${providerId.parse(id)}`, { method: 'GET' }));
}

/** Reconcilia los ultimos cobros de un contrato, sin iniciar cobros nuevos. */
export async function listarFacturasMercadoPago(preapprovalId: string): Promise<FacturaMercadoPago[]> {
  const response = await mercadoPagoRequest(`/authorized_payments/search?preapproval_id=${providerId.parse(preapprovalId)}&limit=50&offset=0`, { method: 'GET' });
  return z.object({ results: z.array(invoiceSchema) }).parse(response).results;
}

/** Recupera un checkout tras una interrupcion sin crear otro contrato recurrente. */
export async function buscarPreapprovalMercadoPago(reference: string): Promise<PreapprovalMercadoPago | null> {
  const response = await mercadoPagoRequest(`/preapproval/search?external_reference=${encodeURIComponent(reference)}&limit=20`, { method: 'GET' });
  const matches = z.object({ results: z.array(preapprovalSchema) }).parse(response).results
    .filter(item => item.external_reference === reference && item.status !== 'cancelled');
  if (matches.length > 1) throw new ApiError('El proveedor requiere revisar contratos duplicados antes de continuar.', 409);
  return matches[0] ?? null;
}

/** Cambia el importe de los proximos debitos sin cobrar ni prorratear ahora. */
export async function actualizarImporteMercadoPago(id: string, amount: number, currency: string): Promise<void> {
  await mercadoPagoRequest(`/preapproval/${providerId.parse(id)}`, { method: 'PUT',
    body: { auto_recurring: { transaction_amount: amount, currency_id: currency } } });
}

/**
 * Valida firma de webhook cuando MERCADOPAGO_WEBHOOK_SECRET está configurado.
 */
export const validarFirmaMercadoPago = (
  xSignature: string | undefined,
  xRequestId: string | undefined,
  dataId: string | undefined
): boolean => {
  if (!env.MERCADOPAGO_WEBHOOK_SECRET) {
    return false;
  }

  if (!xSignature || !xRequestId || !dataId) {
    return false;
  }

  const firma = xSignature
    .split(',')
    .map((parte) => parte.trim().split('='))
    .find(([clave]) => clave === 'v1')?.[1];

  if (!firma || !/^[a-fA-F0-9]{64}$/.test(firma) || !/^\d{10,13}$/.test(extraerTimestampFirma(xSignature))) {
    return false;
  }

  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${extraerTimestampFirma(xSignature)};`;
  const expected = crypto
    .createHmac('sha256', env.MERCADOPAGO_WEBHOOK_SECRET)
    .update(manifest)
    .digest('hex');

  if (expected.length !== firma.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(firma, 'hex'));
};

interface MercadoPagoRequestOptions {
  method: 'GET' | 'POST' | 'PUT';
  body?: Record<string, unknown>;
  timeoutMs?: number;
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
    signal: AbortSignal.timeout(options.timeoutMs ?? 15000),
    redirect: 'error',
    method: options.method,
    headers: {
      Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError('Mercado Pago no pudo completar la operacion. Intentalo nuevamente.', 502);
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
