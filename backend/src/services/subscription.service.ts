/**
 * @archivo subscription.service.ts
 * @descripcion Catalogo, contratos mensuales y conciliacion de pagos sin confiar en el cliente.
 */
import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { ApiError } from '../middleware/error.middleware';
import type { Suscripcion, PlanSuscripcion } from '../models/Subscription';
import type { HistorialSuscripcion, ResultadoCheckoutSuscripcion } from '../models/subscription.model';
import type { RolUsuario } from '../models/User';
import type { BillingAudience, BillingOverview, CommercialPlan } from '../../../shared/billing';
import { env } from '../config/env';
import { billingExchangeService } from './billing-exchange.service';
import { BILLING_CATALOG_VERSION, COMMERCIAL_PLANS, CONTRACT_FEE_BASIS_POINTS } from '../constants/billing';
import { amountMinor, calculateTransactionFee, hasPaidAccess, nextBillingMonth } from '../utils/billing';
import type { DatosCancelarSuscripcion, DatosSuscribirse } from '../validators/subscription.validator';
import { subscriptionRepository, billingAudience } from '../repositories/subscription.repository';
import { userRepository } from '../repositories/user.repository';
import {
  cancelarPreapprovalMercadoPago, crearPreapprovalMercadoPago, mercadoPagoDisponible,
  obtenerPagoMercadoPago, obtenerPreapprovalMercadoPago, validarFirmaMercadoPago,
  buscarPreapprovalMercadoPago, actualizarImporteMercadoPago, obtenerFacturaMercadoPago, listarFacturasMercadoPago,
  type WebhookMercadoPago, type FacturaMercadoPago,
} from '../integrations/mercadopago';

export type PlanDisponible = CommercialPlan;
export interface ResultadoHistorialSuscripcion { suscripciones: Suscripcion[]; eventos: HistorialSuscripcion[] }

/** Servicio comercial unico; Mercado Pago realiza el cobro automatico mensual. */
export class SubscriptionService {
  /** Precios de nuevos contratos; mantiene IDs y no modifica suscripciones anteriores. */
  async listarPlanes(audience?: BillingAudience): Promise<CommercialPlan[]> {
    const plans = COMMERCIAL_PLANS.filter(plan => !audience || plan.audience === audience);
    const exchangeRate = plans.some(plan => plan.priceUsd > 0) ? await billingExchangeService.get() : null;
    return plans.map(base => {
      const override = base.id === 'gratuito' ? undefined : env.BILLING_CATALOG_JSON[base.id];
      const priceUsd = override?.priceUsd ?? base.priceUsd; const limits = override?.limits ?? base.limits;
      const localPrice = priceUsd === 0 ? 0 : exchangeRate ? amountMinor(priceUsd * exchangeRate.rate) / 100 : null;
      return { ...base, priceUsd, limits, precioMensual: localPrice, moneda: env.MERCADOPAGO_CURRENCY,
        ...(priceUsd > 0 && exchangeRate ? { exchangeRate } : {}),
        available: priceUsd === 0 || (localPrice !== null && mercadoPagoDisponible()
          && Boolean(env.MERCADOPAGO_WEBHOOK_SECRET && env.MERCADOPAGO_NOTIFICATION_URL)),
        limitesEmpresa: { trabajosPublicados: limits.trabajosPublicados, consultasIA: limits.consultasIA, perfilesVisibles: limits.perfilesVisibles },
        limitesProfesional: { propuestasEnviadas: limits.propuestasEnviadas, consultasIA: limits.consultasIA } };
    });
  }

  /** Inicia o recupera el unico checkout pendiente del titular. */
  async crearCheckout(uid: string, role: RolUsuario, data: DatosSuscribirse): Promise<ResultadoCheckoutSuscripcion> {
    const audience = await this.audience(uid, role);
    const plan = await this.plan(data.plan, audience);
    return subscriptionRepository.withAccountLock(uid, async () => {
      const current = await this.obtenerActual(uid);
      let pending = await subscriptionRepository.pending(uid);
      if (!pending && current?.estado === 'pendiente_pago') pending = current;
      if (pending && pending.plan !== plan.id) throw new ApiError('Primero cancela o completa el checkout pendiente.', 409);
      if (!pending && current?.plan === plan.id && (hasPaidAccess(current) || (plan.id === 'gratuito' && current.estado === 'activa'))) {
        return { suscripcion: current, checkout: { proveedor: 'interno', requierePagoExterno: false, estado: 'no_requiere_pago' } };
      }
      if (!pending && current && (hasPaidAccess(current) || (current.mercadoPagoPreapprovalId && current.renovacionAutomatica))) {
        throw new ApiError('Ya tienes un contrato. Cambia de plan desde tu suscripcion actual.', 409);
      }
      if (plan.id !== 'gratuito' && !plan.available) throw new ApiError('El cobro de este plan todavia no esta configurado.', 503);
      if (plan.id !== 'gratuito') this.confirmedPrice(data.expectedPriceMinor, pending?.precioMensual ?? plan.precioMensual!);
      const user = await userRepository.findById(uid);
      if (!user) throw new ApiError('Usuario no encontrado para crear suscripcion.', 404);
      const backUrl = this.returnUrl(data.successUrl);
      if (!pending) { pending = this.initial(uid, audience, plan); await subscriptionRepository.createForAccount(pending); }
      if (pending.plan === 'gratuito') return { suscripcion: pending,
        checkout: { proveedor: 'interno', requierePagoExterno: false, estado: 'no_requiere_pago' } };
      if (!pending.mercadoPagoPreapprovalId) {
        const recovered = pending.checkoutAttempted ? await buscarPreapprovalMercadoPago(pending.id) : null;
        if (pending.checkoutAttempted && !recovered) throw new ApiError('Estamos verificando el checkout anterior con Mercado Pago. No se creara otro cobro.', 409);
        if (!recovered) await subscriptionRepository.update(pending.id, { checkoutAttempted: true });
        const created = recovered ? { id: recovered.id, initPoint: recovered.init_point }
          : await crearPreapprovalMercadoPago({ payerEmail: user.email, reason: 'OfiAI - ' + plan.nombre,
            amount: pending.precioMensual, currency: pending.moneda, backUrl, notificationUrl: env.MERCADOPAGO_NOTIFICATION_URL,
            usuarioId: uid, suscripcionId: pending.id, plan: pending.plan });
        const url = this.checkoutUrl(created.initPoint ?? ('sandboxInitPoint' in created ? created.sandboxInitPoint : undefined));
        await subscriptionRepository.update(pending.id, { mercadoPagoPreapprovalId: created.id, checkoutUrl: url });
      }
      const subscription = await this.obtenerSuscripcionPorId(pending.id);
      return { suscripcion: subscription, checkout: { proveedor: 'mercado_pago', id: subscription.mercadoPagoPreapprovalId,
        url: subscription.checkoutUrl, requierePagoExterno: true, estado: 'creado' } };
    });
  }

  /** Resuelve vencimiento sin depender del scheduler. */
  async obtenerActual(uid: string): Promise<Suscripcion | null> {
    const subscription = await subscriptionRepository.findCurrentByUserId(uid);
    if (subscription && subscription.plan !== 'gratuito' && subscription.estado === 'activa'
      && subscription.fechaVencimiento <= new Date()) return { ...subscription, estado: 'vencida' };
    return subscription;
  }

  /** Historial operativo del titular. */
  async obtenerHistorial(uid: string): Promise<ResultadoHistorialSuscripcion> {
    const [suscripciones, eventos] = await Promise.all([
      subscriptionRepository.findHistoryByUserId(uid), subscriptionRepository.findOperationalHistoryByUserId(uid) ]);
    return { suscripciones, eventos };
  }

  /** Estado financiero y permisos efectivos, sin anunciar compras nativas aun no integradas. */
  async overview(uid: string, role: RolUsuario): Promise<BillingOverview> {
    if (role === 'admin') throw new ApiError('Usa el resumen de ingresos de administracion.', 403);
    const [entitlements, payments] = await Promise.all([
      subscriptionRepository.entitlements(uid, role), subscriptionRepository.payments(uid) ]);
    const products = env.BILLING_STORE_PRODUCTS_JSON.filter(product => product.audience === role &&
      COMMERCIAL_PLANS.some(plan => plan.audience === role && plan.id === product.plan));
    const pending = await subscriptionRepository.pending(uid);
    return { pendingCheckout: pending ? { id: pending.id, plan: pending.plan } : null,
      entitlements, payments, stores: { products, purchasesEnabled: false },
      transactionFee: { configured: true, basisPoints: CONTRACT_FEE_BASIS_POINTS, collectionEnabled: false } };
  }

  /** Comision indicativa: no debita ni contabiliza ingresos ficticios. */
  feePreview(grossMinor: number): { feeMinor: number; professionalAmountMinor: number; contractorTotalMinor: number; payer: 'contractor'; collectionEnabled: false } {
    const feeMinor = calculateTransactionFee(grossMinor, CONTRACT_FEE_BASIS_POINTS);
    if (!Number.isSafeInteger(grossMinor + feeMinor)) throw new ApiError('Importe invalido.', 400);
    return { feeMinor, professionalAmountMinor: grossMinor, contractorTotalMinor: grossMinor + feeMinor,
      payer: 'contractor', collectionEnabled: false };
  }

  /** Cancela debitos futuros, conservando por defecto el periodo pagado. */
  async cancelarSuscripcion(id: string, uid: string, role: RolUsuario, data: DatosCancelarSuscripcion): Promise<Suscripcion> {
    const owned = await this.obtenerSuscripcionPorId(id); this.validarPropietario(owned, uid, role);
    return subscriptionRepository.withAccountLock(owned.usuarioId, () => this.cancel(owned, data));
  }

  /** Cancelacion idempotente dentro del bloqueo comercial. */
  private async cancel(owned: Suscripcion, data: DatosCancelarSuscripcion): Promise<Suscripcion> {
    const subscription = await this.obtenerSuscripcionPorId(owned.id);
    if (subscription.cancelAtPeriodEnd || subscription.estado === 'cancelada') return subscription;
    let providerId = subscription.mercadoPagoPreapprovalId;
    if (!providerId && subscription.checkoutAttempted) {
      const recovered = await buscarPreapprovalMercadoPago(subscription.id);
      if (!recovered) throw new ApiError('El checkout sigue en conciliacion. No se puede confirmar la cancelacion aun.', 409);
      providerId = recovered.id;
    }
    if (providerId) {
      if (!mercadoPagoDisponible()) throw new ApiError('Mercado Pago no esta disponible para confirmar la cancelacion.', 503);
      const provider = await obtenerPreapprovalMercadoPago(providerId);
      if (provider.status !== 'cancelled') await cancelarPreapprovalMercadoPago(providerId);
    }
    await subscriptionRepository.update(subscription.id, { renovacionAutomatica: false,
      cancelAtPeriodEnd: data.cancelarAlFinalDelPeriodo,
      estado: data.cancelarAlFinalDelPeriodo && hasPaidAccess(subscription) ? 'activa' : 'cancelada',
      ...(providerId ? { mercadoPagoPreapprovalId: providerId, providerStatus: 'cancelled' } : {}) });
    await subscriptionRepository.clearPending(subscription.usuarioId, subscription.id);
    await this.event(subscription, 'cancelacion_solicitada', data.cancelarAlFinalDelPeriodo
      ? 'Renovacion desactivada. Se conserva el periodo pagado.' : 'Suscripcion cancelada. No se solicito un reembolso.');
    return this.obtenerSuscripcionPorId(subscription.id);
  }

  /** Upgrade o downgrade al siguiente ciclo, sin prorrateo ni crear otro contrato. */
  async cambiarPlan(id: string, uid: string, role: RolUsuario, planId: PlanSuscripcion, expectedPriceMinor?: number): Promise<Suscripcion> {
    const owned = await this.obtenerSuscripcionPorId(id); this.validarPropietario(owned, uid, role);
    const plan = await this.plan(planId, await this.audience(owned.usuarioId, owned.rolUsuario === 'profesional' ? 'profesional' : 'empresa'));
    return subscriptionRepository.withAccountLock(owned.usuarioId, async () => {
      const current = await this.obtenerSuscripcionPorId(id);
      if (plan.id === 'gratuito') return this.cancel(current, { cancelarAlFinalDelPeriodo: true });
      if (!plan.available || plan.precioMensual === null) throw new ApiError('El cobro del plan no esta configurado.', 503);
      if (current.moneda !== plan.moneda) throw new ApiError('El cambio de moneda requiere una revision del contrato.', 409);
      if (!current.mercadoPagoPreapprovalId || !current.renovacionAutomatica || !hasPaidAccess(current)) {
        throw new ApiError('Necesitas un contrato pago vigente con renovacion activa para cambiar de plan.', 409);
      }
      if (current.pendingPlan && current.pendingPlan.plan !== plan.id) throw new ApiError('Ya hay un cambio de plan pendiente.', 409);
      if (current.plan === plan.id && !current.pendingPlan) return current;
      const pending = current.pendingPlan ?? { plan: plan.id, precioMensual: plan.precioMensual,
        priceUsd: plan.priceUsd, limits: plan.limits, effectiveAt: current.fechaVencimiento.toISOString(),
        ...(plan.exchangeRate ? { exchangeRate: plan.exchangeRate } : {}) };
      this.confirmedPrice(expectedPriceMinor, pending.precioMensual);
      await subscriptionRepository.update(id, { pendingPlan: pending });
      await actualizarImporteMercadoPago(current.mercadoPagoPreapprovalId, pending.precioMensual, current.moneda);
      await this.event(current, 'cambio_plan_programado', 'Cambio a ' + plan.nombre + ' desde el siguiente periodo confirmado.');
      return this.obtenerSuscripcionPorId(id);
    });
  }

  /** Concilia renovaciones automaticas; pulsar este endpoint no extiende periodos por si solo. */
  async renovarSuscripcion(id: string, uid: string, role: RolUsuario, maxInvoices = 50): Promise<Suscripcion> {
    let subscription = await this.obtenerSuscripcionPorId(id); this.validarPropietario(subscription, uid, role);
    if (!subscription.mercadoPagoPreapprovalId && subscription.checkoutAttempted) {
      const recovered = await buscarPreapprovalMercadoPago(subscription.id);
      if (recovered) {
        await subscriptionRepository.update(id, { mercadoPagoPreapprovalId: recovered.id,
          ...(recovered.init_point ? { checkoutUrl: this.checkoutUrl(recovered.init_point) } : {}) });
        subscription = await this.obtenerSuscripcionPorId(id);
      }
    }
    if (!subscription.mercadoPagoPreapprovalId) return subscription;
    await this.sincronizarPreapproval(subscription.mercadoPagoPreapprovalId);
    const invoices = await listarFacturasMercadoPago(subscription.mercadoPagoPreapprovalId);
    for (const invoice of invoices.sort((a, b) => b.debit_date.localeCompare(a.debit_date)).slice(0, maxInvoices)) await this.invoice(invoice);
    return this.obtenerSuscripcionPorId(id);
  }

  /** Verifica HMAC sobre data.id de la URL y consulta al proveedor antes de conceder acceso. */
  async procesarWebhookMercadoPago(payload: WebhookMercadoPago, signature?: string, requestId?: string,
    queryId?: string): Promise<{ recibido: true; tipo: string }> {
    const id = queryId ?? payload.data?.id;
    if (!id || !/^[a-zA-Z0-9_-]{1,160}$/.test(id) || (payload.data?.id && String(payload.data.id).toLowerCase() !== id.toLowerCase())
      || !validarFirmaMercadoPago(signature, requestId, id)) throw new ApiError('Firma invalida de Mercado Pago.', 401);
    const type = payload.type ?? '';
    if (type === 'subscription_preapproval') await this.sincronizarPreapproval(id);
    else if (type === 'subscription_authorized_payment') await this.invoice(await obtenerFacturaMercadoPago(id));
    else if (type === 'payment') {
      const existing = await subscriptionRepository.payment(id);
      if (existing) await this.invoice(await obtenerFacturaMercadoPago(existing.invoiceId));
    }
    return { recibido: true, tipo: type };
  }

  /** Valida identidad, factura e importe del pago recurrente. */
  private async invoice(invoice: FacturaMercadoPago): Promise<void> {
    if (!invoice.payment) return;
    const subscription = await subscriptionRepository.findByMercadoPagoPreapprovalId(invoice.preapproval_id);
    if (!subscription) return;
    const payment = await obtenerPagoMercadoPago(String(invoice.payment.id));
    if (!['approved', 'refunded', 'charged_back'].includes(payment.status)) return;
    if (String(payment.id) !== String(invoice.payment.id) || payment.currency_id !== invoice.currency_id
      || amountMinor(payment.transaction_amount) !== amountMinor(invoice.transaction_amount)
      || (payment.external_reference && payment.external_reference !== subscription.id)
      || (env.NODE_ENV === 'production' && payment.live_mode !== true) || !payment.date_approved) {
      throw new ApiError('El pago no coincide con la factura recurrente.', 409);
    }
    await subscriptionRepository.applyPayment(subscription.id, { id: String(payment.id), invoiceId: invoice.id,
      amount: payment.transaction_amount, refunded: payment.status === 'refunded' ? payment.transaction_amount : payment.transaction_amount_refunded ?? 0,
      currency: payment.currency_id, status: payment.status as 'approved' | 'refunded' | 'charged_back',
      paidAt: payment.date_approved, periodStart: invoice.debit_date });
  }

  /** Una autorizacion no es un pago; solo modifica estado de renovacion. */
  private async sincronizarPreapproval(id: string): Promise<void> {
    const provider = await obtenerPreapprovalMercadoPago(id);
    let subscription = await subscriptionRepository.findByMercadoPagoPreapprovalId(id);
    if (!subscription && provider.external_reference) subscription = await subscriptionRepository.findById(provider.external_reference);
    if (!subscription || provider.external_reference !== subscription.id
      || (subscription.mercadoPagoPreapprovalId && subscription.mercadoPagoPreapprovalId !== id)) return;
    const cancelled = provider.status === 'cancelled' || provider.status === 'paused';
    await subscriptionRepository.update(subscription.id, { mercadoPagoPreapprovalId: id, providerStatus: provider.status,
      renovacionAutomatica: provider.status === 'authorized' && !subscription.cancelAtPeriodEnd,
      ...(cancelled ? { ...(provider.status === 'cancelled' ? { cancelAtPeriodEnd: true } : {}),
        estado: hasPaidAccess(subscription) ? 'activa' : 'cancelada' } : {}) });
    if (cancelled) await subscriptionRepository.clearPending(subscription.usuarioId, subscription.id);
  }

  /** Captura condiciones economicas inmutables del nuevo contrato. */
  private initial(uid: string, role: BillingAudience, plan: CommercialPlan): Suscripcion {
    const now = new Date();
    return { id: firestore.collection(COLECCIONES.SUSCRIPCIONES).doc().id, usuarioId: uid, rolUsuario: role,
      plan: plan.id, estado: plan.priceUsd === 0 ? 'activa' : 'pendiente_pago', precioMensual: plan.precioMensual ?? 0,
      moneda: plan.moneda, fechaInicio: now, fechaVencimiento: plan.priceUsd === 0 ? nextBillingMonth(now) : now,
      renovacionAutomatica: plan.priceUsd > 0, limitesActuales: plan.limits, catalogVersion: BILLING_CATALOG_VERSION,
      ...(plan.exchangeRate ? { exchangeRate: plan.exchangeRate } : {}),
      priceUsd: plan.priceUsd, fechaCreacion: now, fechaActualizacion: now };
  }

  /** Rechaza planes de otra audiencia. */
  private async plan(id: PlanSuscripcion, role: BillingAudience): Promise<CommercialPlan> {
    if (!COMMERCIAL_PLANS.some(item => item.id === id && item.audience === role)) {
      throw new ApiError('Ese plan no corresponde al tipo de cuenta.', 403);
    }
    const plan = (await this.listarPlanes(role)).find(item => item.id === id && item.audience === role);
    if (!plan) throw new ApiError('Ese plan no corresponde al tipo de cuenta.', 403);
    return plan;
  }

  /** Protege la gratuidad personal y profesional incluso ante peticiones manipuladas. */
  private async audience(uid: string, role: RolUsuario): Promise<BillingAudience> {
    if (role === 'admin') throw new ApiError('Ese plan no corresponde al tipo de cuenta.', 403);
    const user = await userRepository.findById(uid);
    if (!user || user.rol !== role || !user.activo) throw new ApiError('Cuenta no disponible.', 403);
    return billingAudience(role, user);
  }

  /** El precio del cliente solo confirma consentimiento; nunca determina el importe a cobrar. */
  private confirmedPrice(expectedPriceMinor: number | undefined, serverPrice: number): void {
    if (expectedPriceMinor !== amountMinor(serverPrice)) {
      throw new ApiError('El importe cambio o falta confirmarlo. Actualiza los planes antes de continuar; si hay un checkout pendiente, revisalo o cancelalo.', 409);
    }
  }

  /** Restringe el retorno a origenes exactos autorizados por el servidor. */
  private returnUrl(value?: string): string {
    const url = new URL(value ?? env.CORS_ORIGINS[0] + '/subscriptions/success');
    if (!env.CORS_ORIGINS.includes(url.origin) || url.username || url.password
      || !['http:', 'https:'].includes(url.protocol) || (env.NODE_ENV === 'production' && url.protocol !== 'https:')) {
      throw new ApiError('La URL de retorno no esta autorizada.', 400);
    }
    return url.toString();
  }

  /** Solo devuelve checkouts HTTPS de Mercado Pago. */
  private checkoutUrl(value: unknown): string {
    if (typeof value !== 'string') throw new ApiError('Mercado Pago no devolvio un checkout valido.', 502);
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password
      || !/^(www\.)?mercadopago\.(com|com\.ar|com\.br|com\.mx|com\.co|com\.uy|com\.pe|cl)$/.test(url.hostname)) {
      throw new ApiError('Mercado Pago no devolvio un checkout valido.', 502);
    }
    return value;
  }

  /** Obtiene un contrato o responde ausencia. */
  private async obtenerSuscripcionPorId(id: string): Promise<Suscripcion> {
    const subscription = await subscriptionRepository.findById(id);
    if (!subscription) throw new ApiError('Suscripcion no encontrada.', 404);
    return subscription;
  }

  /** Oculta contratos ajenos. */
  private validarPropietario(subscription: Suscripcion, uid: string, role: RolUsuario): void {
    if (role !== 'admin' && subscription.usuarioId !== uid) throw new ApiError('Suscripcion no encontrada.', 404);
  }

  /** Audita sin guardar tarjetas, tokens ni payloads externos. */
  private async event(subscription: Suscripcion, evento: string, descripcion: string): Promise<void> {
    await subscriptionRepository.addHistory({ suscripcionId: subscription.id, usuarioId: subscription.usuarioId, evento, descripcion });
  }
}
export const subscriptionService = new SubscriptionService();
