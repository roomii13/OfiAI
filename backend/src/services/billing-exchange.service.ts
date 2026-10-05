/** @archivo billing-exchange.service.ts @descripcion Cotizacion mensual USD/ARS con cache acotada y fallo seguro. */
import { env } from '../config/env';
import { obtenerCotizacionMercadoPago } from '../integrations/mercadopago';
import type { BillingExchangeRate } from '../../../shared/billing';

const CACHE_TTL_MS = 60 * 60 * 1000;
const FAILURE_BACKOFF_MS = 60 * 1000;
const MAX_RATE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Comparte una consulta concurrente por proceso; no inventa una tasa si el proveedor falla. */
export class BillingExchangeService {
  private cached: BillingExchangeRate | null = null;
  private expiresAt = 0;
  private retryAfter = 0;
  private pending: Promise<BillingExchangeRate | null> | null = null;

  /** Mantiene la configuracion manual existente o consulta la cotizacion de Mercado Pago. */
  async get(): Promise<BillingExchangeRate | null> {
    if (env.MERCADOPAGO_CURRENCY !== 'ARS') return null;
    if (env.BILLING_USD_TO_ARS) return { source: 'manual', base: 'USD', quote: 'ARS',
      rate: env.BILLING_USD_TO_ARS, asOf: new Date().toISOString() };
    if (!env.MERCADOPAGO_ACCESS_TOKEN || !env.MERCADOPAGO_PUBLIC_KEY) return null;
    if (this.cached && Date.now() < this.expiresAt && this.fresh(this.cached.asOf)) return { ...this.cached };
    if (Date.now() < this.retryAfter) return null;
    if (!this.pending) this.pending = this.refresh().finally(() => { this.pending = null; });
    return this.pending;
  }

  /** Tolera dias no habiles, pero rechaza fechas futuras o demasiado antiguas. */
  private fresh(asOf: string): boolean {
    const age = Date.now() - Date.parse(asOf);
    return Number.isFinite(age) && age >= -5 * 60 * 1000 && age <= MAX_RATE_AGE_MS;
  }

  /** Guarda solamente datos de cotizacion; los errores externos nunca se envian al cliente. */
  private async refresh(): Promise<BillingExchangeRate | null> {
    try {
      const result = await obtenerCotizacionMercadoPago();
      if (!this.fresh(result.asOf) || !Number.isFinite(result.rate) || result.rate <= 0 || result.rate > 1000000) {
        throw new Error('Cotizacion invalida o vencida.');
      }
      this.cached = { source: 'mercadopago', base: 'USD', quote: 'ARS', ...result };
      this.expiresAt = Date.now() + CACHE_TTL_MS;
      this.retryAfter = 0;
      return { ...this.cached };
    } catch {
      this.cached = null;
      this.retryAfter = Date.now() + FAILURE_BACKOFF_MS;
      return null;
    }
  }
}

export const billingExchangeService = new BillingExchangeService();
