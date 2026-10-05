/**
 * @archivo subscription.repository.ts
 * @descripcion Repositorio Firestore para suscripciones, historial y búsqueda por proveedor de pagos.
 * Aísla persistencia del módulo Suscripciones siguiendo Clean Architecture.
 * @modulo Repositories
 */

import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { Suscripcion } from '../models/Subscription';
import { HistorialSuscripcion } from '../models/subscription.model';
import { logger } from '../config/logger';
import { randomUUID } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type { BillingAudience, BillingEntitlements, BillingLimits, BillingPayment } from '../../../shared/billing';
import { COMMERCIAL_PLANS } from '../constants/billing';
import { amountMinor, billingDate, hasPaidAccess, nextBillingMonth } from '../utils/billing';
import { ApiError } from '../middleware/error.middleware';

interface BillingAccount {
  currentSubscriptionId?: string;
  pendingSubscriptionId?: string | null;
  lease?: { token: string; expiresAt: number } | null;
}
interface StoredPayment extends BillingPayment { usuarioId: string; invoiceId: string; updatedAt: string }
export interface VerifiedRecurringPayment {
  id: string; invoiceId: string; amount: number; refunded: number; currency: string;
  status: BillingPayment['status']; paidAt: string; periodStart: string;
}

/** Convierte los Timestamp almacenados para comparar y serializar fechas reales. */
function normalizeSubscription(data: Suscripcion): Suscripcion {
  return { ...data, fechaInicio: billingDate(data.fechaInicio), fechaVencimiento: billingDate(data.fechaVencimiento),
    fechaCreacion: billingDate(data.fechaCreacion), fechaActualizacion: billingDate(data.fechaActualizacion) };
}

/** Resuelve permisos desde datos del servidor y nunca desde claims de plan del cliente. */
export function subscriptionEntitlements(subscription: Suscripcion | null, role: BillingAudience,
  used: Partial<BillingLimits> = {}, now = new Date()): BillingEntitlements {
  const paid = subscription?.rolUsuario === role && hasPaidAccess(subscription, now);
  const free = COMMERCIAL_PLANS.find(plan => plan.id === 'gratuito' && plan.audience === role)!;
  const limits: BillingLimits = paid && subscription ? { ...free.limits, ...subscription.limitesActuales } : { ...free.limits };
  return { plan: paid && subscription ? subscription.plan : 'gratuito', paid, period: now.toISOString().slice(0, 7),
    limits, used, features: { publishJobs: role === 'empresa' && limits.trabajosPublicados !== 0,
      sendProposals: role === 'profesional' && limits.propuestasEnviadas !== 0, financialHistory: true } };
}

/**
 * Repositorio de suscripciones sobre Firestore.
 */
export class SubscriptionRepository {
  /** Permite verificar las mismas transacciones contra Firestore y un adaptador de pruebas. */
  constructor(private readonly db: Firestore = firestore) {}

  /** Cuenta comercial unica del usuario. */
  private account(uid: string) { return this.db.collection(COLECCIONES.BILLING_ACCOUNTS).doc(uid); }

  /** Documento de uso del mes calendario UTC; cambiar de plan no reinicia contadores. */
  private usage(uid: string) {
    return this.account(uid).collection(COLECCIONES.BILLING_USAGE).doc(new Date().toISOString().slice(0, 7));
  }
  /** Coleccion existente de contratos. */
  private get coleccionSuscripciones() {
    return this.db.collection(COLECCIONES.SUSCRIPCIONES);
  }

  /** Historial operativo compatible con contratos anteriores. */
  private get coleccionHistorial() {
    return this.db.collection(COLECCIONES.HISTORIAL_SUSCRIPCIONES);
  }

  /**
   * Crea una suscripción.
   */
  async create(suscripcion: Suscripcion): Promise<Suscripcion> {
    await this.coleccionSuscripciones.doc(suscripcion.id).set(suscripcion);
    logger.info(`Suscripción creada: ${suscripcion.id}`);
    return suscripcion;
  }

  /**
   * Busca una suscripción por ID.
   */
  async findById(id: string): Promise<Suscripcion | null> {
    const doc = await this.coleccionSuscripciones.doc(id).get();
    return doc.exists ? normalizeSubscription(doc.data() as Suscripcion) : null;
  }

  /**
   * Busca la suscripción activa o pendiente más reciente de un usuario.
   */
  async findCurrentByUserId(usuarioId: string): Promise<Suscripcion | null> {
    const account = (await this.account(usuarioId).get()).data() as BillingAccount | undefined;
    const id = account?.currentSubscriptionId ?? account?.pendingSubscriptionId;
    if (id) return this.findById(id);
    const snapshot = await this.coleccionSuscripciones
      .where('usuarioId', '==', usuarioId)
      .orderBy('fechaCreacion', 'desc').limit(100)
      .get();
    const all = snapshot.docs.map(doc => normalizeSubscription(doc.data() as Suscripcion));
    return all.find(s => hasPaidAccess(s)) ?? all.find(s => s.estado === 'pendiente_pago') ?? all[0] ?? null;
  }

  /**
   * Busca una suscripción por identificador de preapproval de Mercado Pago.
   */
  async findByMercadoPagoPreapprovalId(mercadoPagoPreapprovalId: string): Promise<Suscripcion | null> {
    const snapshot = await this.coleccionSuscripciones
      .where('mercadoPagoPreapprovalId', '==', mercadoPagoPreapprovalId)
      .limit(1)
      .get();

    const data = snapshot.docs[0]?.data() as Suscripcion | undefined;
    return data ? normalizeSubscription(data) : null;
  }

  /**
   * Lista historial completo de suscripciones de un usuario.
   */
  async findHistoryByUserId(usuarioId: string, limite = 50): Promise<Suscripcion[]> {
    const snapshot = await this.coleccionSuscripciones
      .where('usuarioId', '==', usuarioId)
      .orderBy('fechaCreacion', 'desc')
      .limit(limite)
      .get();

    return snapshot.docs.map((doc) => normalizeSubscription(doc.data() as Suscripcion));
  }

  /**
   * Actualiza campos parciales de una suscripción.
   */
  async update(id: string, data: Partial<Suscripcion>): Promise<void> {
    await this.coleccionSuscripciones.doc(id).update({
      ...data,
      fechaActualizacion: new Date(),
    });
    logger.info(`Suscripción actualizada: ${id}`);
  }

  /**
   * Registra un evento de historial de suscripción.
   */
  async addHistory(evento: Omit<HistorialSuscripcion, 'id' | 'fecha'>): Promise<HistorialSuscripcion> {
    const id = this.coleccionHistorial.doc().id;
    const historial: HistorialSuscripcion = {
      ...evento,
      id,
      fecha: new Date(),
    };

    await this.coleccionHistorial.doc(id).set(historial);
    return historial;
  }

  /**
   * Lista eventos de historial operacional para un usuario.
   */
  async findOperationalHistoryByUserId(usuarioId: string, limite = 100): Promise<HistorialSuscripcion[]> {
    const snapshot = await this.coleccionHistorial
      .where('usuarioId', '==', usuarioId)
      .orderBy('fecha', 'desc')
      .limit(limite)
      .get();

    return snapshot.docs.map((doc) => ({ ...doc.data(), fecha: billingDate(doc.data().fecha) } as HistorialSuscripcion));
  }

  /** Serializa operaciones comerciales del mismo titular entre multiples procesos. */
  async withAccountLock<T>(uid: string, work: () => Promise<T>): Promise<T> {
    const token = randomUUID(); const ref = this.account(uid);
    await this.db.runTransaction(async tx => {
      const account = (await tx.get(ref)).data() as BillingAccount | undefined;
      if (account?.lease && account.lease.expiresAt > Date.now()) throw new ApiError('Hay una operacion de facturacion en curso. Espera un momento.', 409);
      tx.set(ref, { ...account, lease: { token, expiresAt: Date.now() + 120000 } });
    });
    try { return await work(); }
    finally {
      await this.db.runTransaction(async tx => {
        const account = (await tx.get(ref)).data() as BillingAccount | undefined;
        if (account?.lease?.token === token) tx.update(ref, { lease: null });
      });
    }
  }

  /** Guarda el checkout pendiente antes de llamar al proveedor; conserva el plan actual. */
  async createForAccount(subscription: Suscripcion): Promise<void> {
    await this.db.runTransaction(async tx => {
      const ref = this.account(subscription.usuarioId);
      const account = (await tx.get(ref)).data() as BillingAccount | undefined;
      if (account?.pendingSubscriptionId) throw new ApiError('Ya hay un checkout pendiente. Continua o cancela ese proceso.', 409);
      tx.create(this.coleccionSuscripciones.doc(subscription.id), subscription);
      tx.set(ref, { ...account, ...(subscription.plan === 'gratuito'
        ? { currentSubscriptionId: subscription.id } : { pendingSubscriptionId: subscription.id }) });
    });
  }

  /** Recupera la operacion pendiente sin exponerla a otras cuentas. */
  async pending(uid: string): Promise<Suscripcion | null> {
    const account = (await this.account(uid).get()).data() as BillingAccount | undefined;
    return account?.pendingSubscriptionId ? this.findById(account.pendingSubscriptionId) : null;
  }

  /** Desliga exclusivamente el checkout cancelado, sin tocar el acceso ya pagado. */
  async clearPending(uid: string, id: string): Promise<void> {
    await this.db.runTransaction(async tx => {
      const ref = this.account(uid); const account = (await tx.get(ref)).data() as BillingAccount | undefined;
      if (account?.pendingSubscriptionId === id) tx.update(ref, { pendingSubscriptionId: null });
    });
  }

  /** Registra el pago, periodo y revenue una sola vez, incluso con webhooks concurrentes. */
  async applyPayment(subscriptionId: string, payment: VerifiedRecurringPayment): Promise<void> {
    const now = new Date();
    await this.db.runTransaction(async tx => {
      const ref = this.coleccionSuscripciones.doc(subscriptionId);
      const doc = await tx.get(ref);
      if (!doc.exists) throw new ApiError('Suscripcion no encontrada.', 404);
      const sub = normalizeSubscription(doc.data() as Suscripcion);
      const ledgerRef = this.db.collection(COLECCIONES.BILLING_PAYMENTS).doc('mp_' + payment.id);
      const previous = (await tx.get(ledgerRef)).data() as StoredPayment | undefined;
      if (previous && previous.subscriptionId !== sub.id) throw new ApiError('El pago pertenece a otro contrato.', 409);
      const accountRef = this.account(sub.usuarioId);
      const account = (await tx.get(accountRef)).data() as BillingAccount | undefined;
      const paidAt = billingDate(payment.paidAt); const start = billingDate(payment.periodStart);
      if (start.getTime() > now.getTime() + 86400000 || paidAt.getTime() > now.getTime() + 86400000) throw new ApiError('Periodo del proveedor no valido.', 502);
      const pending = sub.pendingPlan && start >= billingDate(sub.pendingPlan.effectiveAt) ? sub.pendingPlan : null;
      const expected = previous?.amountMinor ?? amountMinor(pending?.precioMensual ?? sub.precioMensual);
      if (amountMinor(payment.amount) !== expected || payment.currency !== sub.moneda || expected <= 0) {
        throw new ApiError('El importe o moneda no coincide con el contrato. Requiere conciliacion.', 409);
      }
      const refundedMinor = payment.status === 'charged_back' ? expected : amountMinor(payment.refunded);
      if (refundedMinor > expected) throw new ApiError('El reintegro supera el importe del pago.', 502);
      // Un estado atrasado nunca revierte un reintegro ya contabilizado.
      if (previous && (refundedMinor < previous.refundedMinor ||
        (previous.refundedMinor === refundedMinor && previous.status === payment.status))) return;
      const periodEnd = nextBillingMonth(start);
      const revenueRef = this.db.collection(COLECCIONES.BILLING_REVENUE).doc(paidAt.toISOString().slice(0, 7) + '_' + payment.currency);
      const revenue = (await tx.get(revenueRef)).data() as { grossMinor?: number; refundedMinor?: number; payments?: number } | undefined;
      const ledger: StoredPayment = { id: payment.id, invoiceId: payment.invoiceId, usuarioId: sub.usuarioId,
        subscriptionId: sub.id, amountMinor: expected, refundedMinor, currency: payment.currency,
        status: payment.status, paidAt: paidAt.toISOString(), periodEnd: periodEnd.toISOString(), updatedAt: now.toISOString() };
      tx.set(ledgerRef, ledger);
      tx.set(revenueRef, { month: paidAt.toISOString().slice(0, 7), currency: payment.currency,
        grossMinor: (revenue?.grossMinor ?? 0) + (previous ? 0 : expected),
        refundedMinor: (revenue?.refundedMinor ?? 0) + refundedMinor - (previous?.refundedMinor ?? 0),
        payments: (revenue?.payments ?? 0) + (previous ? 0 : 1), updatedAt: now });
      const latest = !sub.lastPaidAt || paidAt >= billingDate(sub.lastPaidAt);
      if (!previous && latest && refundedMinor < expected) {
        tx.update(ref, { estado: 'activa', fechaInicio: sub.lastPaidAt ? sub.fechaInicio : start,
          fechaVencimiento: sub.lastPaidAt && sub.fechaVencimiento > periodEnd ? sub.fechaVencimiento : periodEnd,
          mercadoPagoPaymentId: payment.id, lastPaidAt: paidAt.toISOString(), fechaActualizacion: now,
          ...(pending ? { plan: pending.plan, precioMensual: pending.precioMensual, priceUsd: pending.priceUsd,
            ...(pending.exchangeRate ? { exchangeRate: pending.exchangeRate } : {}),
            limitesActuales: pending.limits, pendingPlan: null } : {}) });
        if (!account?.currentSubscriptionId || account.pendingSubscriptionId === sub.id || account.currentSubscriptionId === sub.id) {
          tx.set(accountRef, { ...account, currentSubscriptionId: sub.id,
            pendingSubscriptionId: account?.pendingSubscriptionId === sub.id ? null : account?.pendingSubscriptionId ?? null });
        }
      } else if (refundedMinor === expected && sub.mercadoPagoPaymentId === payment.id) {
        tx.update(ref, { estado: 'vencida', fechaVencimiento: now, fechaActualizacion: now });
      }
      const eventId = 'mp_' + payment.id + '_' + refundedMinor + '_' + payment.status;
      tx.set(this.coleccionHistorial.doc(eventId), { id: eventId, suscripcionId: sub.id, usuarioId: sub.usuarioId,
        evento: previous ? 'pago_ajustado' : 'pago_confirmado', descripcion: previous
          ? 'Se registro un reintegro o contracargo.' : 'Pago mensual confirmado por Mercado Pago.', fecha: now });
      tx.set(this.db.collection(COLECCIONES.ANALYTICS_EVENTOS).doc(eventId), {
        id: eventId, tipo: previous ? 'billing_payment_adjusted' : 'billing_payment_confirmed', fecha: now,
        metadata: { amountMinor: expected, refundedMinor, currency: payment.currency, provider: 'mercadopago' },
      });
    });
  }

  /** Obtiene una referencia de conciliacion interna, nunca datos bancarios. */
  async payment(id: string): Promise<StoredPayment | null> {
    const doc = await this.db.collection(COLECCIONES.BILLING_PAYMENTS).doc('mp_' + id).get();
    return doc.exists ? doc.data() as StoredPayment : null;
  }

  /** Ultimos cincuenta pagos del titular; no es una factura fiscal. */
  async payments(uid: string): Promise<BillingPayment[]> {
    const snapshot = await this.db.collection(COLECCIONES.BILLING_PAYMENTS).where('usuarioId', '==', uid)
      .orderBy('paidAt', 'desc').limit(50).get();
    return snapshot.docs.map(doc => {
      const { usuarioId: _uid, invoiceId: _invoice, updatedAt: _date, ...payment } = doc.data() as StoredPayment;
      return payment;
    });
  }

  /** Revenue mensual confirmado, separado por moneda y con reintegros. */
  async revenue(month: string): Promise<Array<{ currency: string; grossMinor: number; refundedMinor: number; netMinor: number; payments: number }>> {
    const snapshot = await this.db.collection(COLECCIONES.BILLING_REVENUE).where('month', '==', month).limit(20).get();
    return snapshot.docs.map(doc => {
      const item = doc.data() as { currency: string; grossMinor: number; refundedMinor: number; payments: number };
      return { currency: item.currency, grossMinor: item.grossMinor, refundedMinor: item.refundedMinor,
        netMinor: item.grossMinor - item.refundedMinor, payments: item.payments };
    });
  }

  /** Permisos y consumo reales, compartidos por web y mobile. */
  async entitlements(uid: string, role: BillingAudience): Promise<BillingEntitlements> {
    const sub = await this.findCurrentByUserId(uid); const used = (await this.usage(uid).get()).data();
    return subscriptionEntitlements(sub, role, used as Partial<BillingLimits> | undefined);
  }

  /** Consume cuota en la misma transaccion que publica el trabajo o guarda la propuesta. */
  async consumeQuota(tx: Transaction, uid: string, role: BillingAudience, feature: keyof BillingLimits, operationId?: string): Promise<void> {
    const receipt = operationId ? this.account(uid).collection('quota_operations').doc(operationId) : null;
    if (receipt && (await tx.get(receipt)).exists) return;
    const account = (await tx.get(this.account(uid))).data() as BillingAccount | undefined;
    let sub: Suscripcion | null = null;
    if (account?.currentSubscriptionId) {
      const snapshot = await tx.get(this.coleccionSuscripciones.doc(account.currentSubscriptionId));
      if (snapshot.exists) sub = normalizeSubscription(snapshot.data() as Suscripcion);
    } else {
      const existing = await tx.get(this.coleccionSuscripciones.where('usuarioId', '==', uid).orderBy('fechaCreacion', 'desc').limit(100));
      sub = existing.docs.map(doc => normalizeSubscription(doc.data() as Suscripcion)).find(s => hasPaidAccess(s)) ?? null;
    }
    const ref = this.usage(uid); const usage = (await tx.get(ref)).data() as Partial<BillingLimits> | undefined;
    const entitlements = subscriptionEntitlements(sub, role, usage);
    const limit = entitlements.limits[feature]; const used = usage?.[feature] ?? 0;
    if (limit !== -1 && used >= limit) throw new ApiError('Alcanzaste el limite mensual de tu plan. Revisa tu suscripcion.', 403);
    tx.set(ref, { ...usage, [feature]: used + 1 });
    if (receipt) tx.create(receipt, { period: entitlements.period, feature });
  }
}

export const subscriptionRepository = new SubscriptionRepository();
