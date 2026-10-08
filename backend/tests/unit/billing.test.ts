/** @archivo billing.test.ts @descripcion Contratos mensuales, ledger, cuotas y cambios sin cobros externos. */
import { firestore } from '../../src/integrations/firebase/admin';
import { MemoryFirestore } from '../intake-fixtures';
import { SubscriptionService } from '../../src/services/subscription.service';
import { subscriptionRepository as repository, subscriptionEntitlements } from '../../src/repositories/subscription.repository';
import { env } from '../../src/config/env';
import { billingOverridesSchema } from '../../src/constants/billing';
import { billingDate, calculateTransactionFee, nextBillingMonth } from '../../src/utils/billing';
import type { Suscripcion } from '../../src/models/Subscription';
import * as mp from '../../src/integrations/mercadopago';
jest.mock('../../src/integrations/firebase/admin', () => ({ firestore: new (jest.requireActual('../intake-fixtures').MemoryFirestore)() }));
jest.mock('../../src/integrations/mercadopago');
const provider = jest.mocked(mp); const db = firestore as unknown as MemoryFirestore;
const service = new SubscriptionService();
const now = new Date('2026-09-26T12:00:00Z');

/** Contrato de prueba con precio ARS definido y sin datos personales reales. */
function subscription(patch: Partial<Suscripcion> = {}): Suscripcion {
  return { id: 'sub-1', usuarioId: 'company-a', rolUsuario: 'empresa', plan: 'empresa', estado: 'pendiente_pago',
    precioMensual: 35000, moneda: 'ARS', fechaInicio: now, fechaVencimiento: now,
    renovacionAutomatica: true, fechaCreacion: now, fechaActualizacion: now,
    mercadoPagoPreapprovalId: 'pre-1', limitesActuales: { trabajosPublicados: 10, consultasIA: 50, perfilesVisibles: 100 },
    ...patch };
}
/** Pago canonico; otro ID con la misma fecha nunca suma meses artificialmente. */
function payment(patch: Partial<Parameters<typeof repository.applyPayment>[1]> = {}) {
  return { id: '101', invoiceId: 'invoice-1', amount: 35000, refunded: 0, currency: 'ARS',
    status: 'approved' as const, paidAt: now.toISOString(), periodStart: now.toISOString(), ...patch };
}
/** Crea el puntero de cuenta equivalente a un checkout persistido. */
async function seed(patch: Partial<Suscripcion> = {}) {
  const value = subscription(patch);
  await db.collection('subscriptions').doc(value.id).set({ ...value });
  await db.collection('billing_accounts').doc(value.usuarioId).set({ pendingSubscriptionId: value.id });
  return value;
}
beforeEach(async () => {
  jest.useFakeTimers({ now }); jest.clearAllMocks(); db.clear();
  Object.assign(env, { BILLING_USD_TO_ARS: 1000, BILLING_CATALOG_JSON: {}, BILLING_STORE_PRODUCTS_JSON: [],
    BILLING_TRANSACTION_FEE_BPS: undefined, MERCADOPAGO_CURRENCY: 'ARS', MERCADOPAGO_WEBHOOK_SECRET: 'test-only-secret' });
  provider.mercadoPagoDisponible.mockReturnValue(true);
  provider.validarFirmaMercadoPago.mockReturnValue(true);
  provider.crearPreapprovalMercadoPago.mockResolvedValue({ id: 'pre-1', initPoint: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=pre-1' });
  provider.obtenerPreapprovalMercadoPago.mockResolvedValue({ id: 'pre-1', status: 'authorized', external_reference: 'sub-1' });
  provider.listarFacturasMercadoPago.mockResolvedValue([]);
  await db.collection('users').doc('company-a').set({ id: 'company-a', email: 'company@example.test', rol: 'empresa', activo: true });
});
afterEach(() => jest.useRealTimers());

it('deja profesionales gratuitos y conserva los planes empresa desde USD20', async () => {
  const companies = await service.listarPlanes('empresa');
  const professionals = await service.listarPlanes('profesional');
  expect(companies.map(p => p.nombre)).toEqual(['FREE', 'BUSINESS', 'BUSINESS PRO', 'ENTERPRISE']);
  expect(companies.map(p => p.priceUsd)).toEqual([0, 20, 79, 149]);
  expect(professionals.map(p => p.priceUsd)).toEqual([0]);
  expect(companies[1]).toMatchObject({ precioMensual: 20000, moneda: 'ARS' });
  expect(professionals[0]).toMatchObject({ precioMensual: 0, moneda: 'ARS', limits: { propuestasEnviadas: -1 } });
});
it.each([
  { plan: 'empresa', priceUsd: 20 }, { plan: 'business_pro', priceUsd: 20 }, { plan: 'enterprise', priceUsd: 20 },
])('valida el minimo comercial de $plan sin imponer el antiguo piso de USD35', ({ plan, priceUsd }) => {
  const limits = { trabajosPublicados: 1, propuestasEnviadas: 1, consultasIA: 1, perfilesVisibles: 1 };
  expect(billingOverridesSchema.safeParse({ [plan]: { priceUsd, limits } }).success).toBe(true);
  expect(billingOverridesSchema.safeParse({ [plan]: { priceUsd: priceUsd - 0.01, limits } }).success).toBe(false);
});
it('no inventa conversion ni crea contratos cuando falta cotizacion local', async () => {
  env.BILLING_USD_TO_ARS = undefined;
  expect((await service.listarPlanes('empresa'))[1]).toMatchObject({ precioMensual: null, available: false });
  await expect(service.crearCheckout('company-a', 'empresa', { plan: 'empresa' })).rejects.toMatchObject({ codigoEstado: 503 });
  expect([...db.documents.keys()].filter(k => k.startsWith('subscriptions/'))).toHaveLength(0);
});
it('rechaza planes de otro rol, admin y redireccion externa', async () => {
  await expect(service.crearCheckout('company-a', 'empresa', { plan: 'profesional' })).rejects.toMatchObject({ codigoEstado: 403 });
  await expect(service.crearCheckout('company-a', 'admin', { plan: 'empresa' })).rejects.toMatchObject({ codigoEstado: 403 });
  await expect(service.crearCheckout('company-a', 'empresa', { plan: 'empresa', expectedPriceMinor: 2000000, successUrl: 'https://evil.example/' })).rejects.toMatchObject({ codigoEstado: 400 });
});
it('recupera el mismo checkout sin crear otra preaprobacion ni activar acceso', async () => {
  const a = await service.crearCheckout('company-a', 'empresa', { plan: 'empresa', expectedPriceMinor: 2000000 });
  const b = await service.crearCheckout('company-a', 'empresa', { plan: 'empresa', expectedPriceMinor: 2000000 });
  expect(a.suscripcion.id).toBe(b.suscripcion.id); expect(provider.crearPreapprovalMercadoPago).toHaveBeenCalledTimes(1);
  expect(a.suscripcion.estado).toBe('pendiente_pago');
  expect(a.suscripcion.precioMensual).toBe(20000);
  expect(provider.crearPreapprovalMercadoPago).toHaveBeenCalledWith(expect.objectContaining({ amount: 20000, currency: 'ARS' }));
  expect((await service.overview('company-a', 'empresa')).entitlements.paid).toBe(false);
});
it('un timeout de checkout no habilita un segundo contrato a ciegas', async () => {
  provider.crearPreapprovalMercadoPago.mockRejectedValueOnce(new Error('timeout'));
  provider.buscarPreapprovalMercadoPago.mockResolvedValue(null);
  await expect(service.crearCheckout('company-a', 'empresa', { plan: 'empresa', expectedPriceMinor: 2000000 })).rejects.toThrow('timeout');
  await expect(service.crearCheckout('company-a', 'empresa', { plan: 'empresa', expectedPriceMinor: 2000000 })).rejects.toMatchObject({ codigoEstado: 409 });
  expect(provider.crearPreapprovalMercadoPago).toHaveBeenCalledTimes(1);
});
it('rechaza un checkout con dominio no autorizado devuelto por el proveedor', async () => {
  provider.crearPreapprovalMercadoPago.mockResolvedValueOnce({ id: 'pre-1', initPoint: 'https://mercadopago.com.ar.evil.example/pay' });
  await expect(service.crearCheckout('company-a', 'empresa', { plan: 'empresa', expectedPriceMinor: 2000000 })).rejects.toMatchObject({ codigoEstado: 502 });
});
it('serializa operaciones de la misma cuenta entre procesos', async () => {
  const results = await Promise.allSettled([
    service.crearCheckout('company-a', 'empresa', { plan: 'empresa', expectedPriceMinor: 2000000 }),
    service.crearCheckout('company-a', 'empresa', { plan: 'empresa', expectedPriceMinor: 2000000 }),
  ]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(provider.crearPreapprovalMercadoPago).toHaveBeenCalledTimes(1);
});
it('pago repetido concurrente concede un unico periodo y registra revenue una vez', async () => {
  await seed();
  await Promise.all(Array.from({ length: 8 }, () => repository.applyPayment('sub-1', payment())));
  expect((await repository.findById('sub-1'))?.fechaVencimiento.toISOString()).toBe('2026-10-26T12:00:00.000Z');
  expect(await repository.revenue('2026-09')).toEqual([{ currency: 'ARS', grossMinor: 3500000, refundedMinor: 0, netMinor: 3500000, payments: 1 }]);
  expect((await service.overview('company-a', 'empresa')).entitlements.paid).toBe(true);
});
it('un segundo ID del mismo ciclo no extiende otro mes', async () => {
  await seed(); await repository.applyPayment('sub-1', payment()); await repository.applyPayment('sub-1', payment({ id: '102' }));
  expect((await repository.findById('sub-1'))?.fechaVencimiento.toISOString()).toBe('2026-10-26T12:00:00.000Z');
});
it('reconcilia meses fuera de orden sin retroceder acceso', async () => {
  await seed(); await repository.applyPayment('sub-1', payment());
  await repository.applyPayment('sub-1', payment({ id: '100', paidAt: '2026-08-26T12:00:00Z', periodStart: '2026-08-26T12:00:00Z' }));
  expect((await repository.findById('sub-1'))?.fechaVencimiento.toISOString()).toBe('2026-10-26T12:00:00.000Z');
});
it.each([{ amount: 1 }, { currency: 'USD' }, { refunded: 35001 }])('rechaza pagos incompatibles %j', async patch => {
  await seed(); await expect(repository.applyPayment('sub-1', payment(patch))).rejects.toBeInstanceOf(Error);
  expect(await repository.payments('company-a')).toHaveLength(0);
});
it('reintegro parcial no revoca acceso, reintegro total si; repetir no duplica', async () => {
  await seed(); await repository.applyPayment('sub-1', payment());
  await repository.applyPayment('sub-1', payment({ refunded: 1000 }));
  expect((await repository.entitlements('company-a', 'empresa')).paid).toBe(true);
  await repository.applyPayment('sub-1', payment({ status: 'refunded', refunded: 35000 }));
  await repository.applyPayment('sub-1', payment({ status: 'refunded', refunded: 35000 }));
  await repository.applyPayment('sub-1', payment());
  expect((await repository.entitlements('company-a', 'empresa')).paid).toBe(false);
  expect((await repository.revenue('2026-09'))[0]?.netMinor).toBe(0);
});
it('autorizacion y conciliacion manual sin pago nunca extienden acceso', async () => {
  await seed();
  await service.procesarWebhookMercadoPago({ type: 'subscription_preapproval', data: { id: 'pre-1' } }, 'signature', 'request');
  const before = await repository.findById('sub-1');
  await service.renovarSuscripcion('sub-1', 'company-a', 'empresa');
  expect((await repository.findById('sub-1'))?.fechaVencimiento).toEqual(before?.fechaVencimiento);
  expect((await repository.entitlements('company-a', 'empresa')).paid).toBe(false);
});
it('el webhook de factura consulta authorized_payments y luego el payment real', async () => {
  await seed();
  provider.obtenerFacturaMercadoPago.mockResolvedValue({ id: 'invoice-1', preapproval_id: 'pre-1', debit_date: now.toISOString(),
    currency_id: 'ARS', transaction_amount: 35000, payment: { id: 101, status: 'approved' } });
  provider.obtenerPagoMercadoPago.mockResolvedValue({ id: 101, status: 'approved', transaction_amount: 35000, currency_id: 'ARS', date_approved: now.toISOString() });
  await service.procesarWebhookMercadoPago({ type: 'subscription_authorized_payment', data: { id: 'invoice-1' } }, 'signature', 'request', 'invoice-1');
  expect(provider.obtenerFacturaMercadoPago).toHaveBeenCalledWith('invoice-1');
  expect(provider.obtenerPagoMercadoPago).toHaveBeenCalledWith('101');
  expect((await repository.entitlements('company-a', 'empresa')).paid).toBe(true);
});
it('cancela futuros debitos, conserva acceso y evita otra cancelacion externa', async () => {
  await seed(); await repository.applyPayment('sub-1', payment());
  await service.cancelarSuscripcion('sub-1', 'company-a', 'empresa', { cancelarAlFinalDelPeriodo: true });
  await service.cancelarSuscripcion('sub-1', 'company-a', 'empresa', { cancelarAlFinalDelPeriodo: true });
  expect(provider.cancelarPreapprovalMercadoPago).toHaveBeenCalledTimes(1);
  expect((await repository.entitlements('company-a', 'empresa')).paid).toBe(true);
  jest.setSystemTime(new Date('2026-10-27T00:00:00Z'));
  expect((await repository.entitlements('company-a', 'empresa')).plan).toBe('gratuito');
});
it('programa upgrade sin concederlo hasta el primer cobro del nuevo periodo', async () => {
  await seed(); await repository.applyPayment('sub-1', payment());
  await service.cambiarPlan('sub-1', 'company-a', 'empresa', 'business_pro', 7900000);
  expect((await repository.findById('sub-1'))?.plan).toBe('empresa');
  expect(provider.actualizarImporteMercadoPago).toHaveBeenCalledWith('pre-1', 79000, 'ARS');
  jest.setSystemTime(new Date('2026-10-26T12:01:00Z'));
  await repository.applyPayment('sub-1', payment({ id: '102', amount: 79000, paidAt: '2026-10-26T12:00:00Z', periodStart: '2026-10-26T12:00:00Z' }));
  expect((await repository.findById('sub-1'))?.plan).toBe('business_pro');
});
it('ownership bloquea cancelacion, renovacion y cambios ajenos', async () => {
  await seed();
  await expect(service.cancelarSuscripcion('sub-1', 'other', 'empresa', { cancelarAlFinalDelPeriodo: true })).rejects.toMatchObject({ codigoEstado: 404 });
  await expect(service.renovarSuscripcion('sub-1', 'other', 'empresa')).rejects.toMatchObject({ codigoEstado: 404 });
  await expect(service.cambiarPlan('sub-1', 'other', 'empresa', 'business_pro')).rejects.toMatchObject({ codigoEstado: 404 });
});
it('cuotas son atomicas; dos publicaciones simultaneas no superan FREE', async () => {
  const results = await Promise.allSettled([0, 1].map(() => firestore.runTransaction(async tx => {
    await repository.consumeQuota(tx, 'free-company', 'empresa', 'trabajosPublicados');
  })));
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect((await repository.entitlements('free-company', 'empresa')).used.trabajosPublicados).toBe(1);
});
it('reintentar o negociar una propuesta no consume repetidamente su cuota', async () => {
  for (let i = 0; i < 5; i++) await firestore.runTransaction(tx => repository.consumeQuota(tx, 'pro-a', 'profesional', 'propuestasEnviadas', 'workflow-a'));
  expect((await repository.entitlements('pro-a', 'profesional')).used.propuestasEnviadas).toBe(1);
});
it('normaliza Timestamp, fin de mes y contratos anteriores sin cambiar precios', async () => {
  expect(billingDate({ toDate: () => now })).toEqual(now);
  expect(nextBillingMonth(new Date('2028-01-31T09:00:00Z')).toISOString()).toBe('2028-02-29T09:00:00.000Z');
  expect(nextBillingMonth(new Date('2027-01-31T09:00:00Z')).toISOString()).toBe('2027-02-28T09:00:00.000Z');
  const legacy = subscription({ estado: 'activa', precioMensual: 39900, fechaVencimiento: new Date('2026-10-26T12:00:00Z') });
  expect(subscriptionEntitlements(legacy, 'empresa').limits.trabajosPublicados).toBe(10);
  expect(legacy.precioMensual).toBe(39900);
});
it('una pausa externa no impide reanudar la renovacion al volver a authorized', async () => {
  await seed(); await repository.applyPayment('sub-1', payment());
  provider.obtenerPreapprovalMercadoPago.mockResolvedValueOnce({ id: 'pre-1', status: 'paused', external_reference: 'sub-1' });
  await service.procesarWebhookMercadoPago({ type: 'subscription_preapproval', data: { id: 'pre-1' } }, 'signature', 'request');
  expect((await repository.findById('sub-1'))?.renovacionAutomatica).toBe(false);
  await service.procesarWebhookMercadoPago({ type: 'subscription_preapproval', data: { id: 'pre-1' } }, 'signature', 'request');
  expect((await repository.findById('sub-1'))?.renovacionAutomatica).toBe(true);
});
it('adiciona 10% al contratante, sin disminuir los honorarios ni ejecutar cobros', () => {
  expect(calculateTransactionFee(101, 1000)).toBe(10);
  expect(() => calculateTransactionFee(100, 10001)).toThrow();
  expect(service.feePreview(10000)).toEqual({ feeMinor: 1000, professionalAmountMinor: 10000,
    contractorTotalMinor: 11000, payer: 'contractor', collectionEnabled: false });
});

it('particular no puede comprar planes empresa ni recibir sus cuotas por un parametro manipulado', async () => {
  await db.collection('users').doc('company-a').update({ tipoCuenta: 'particular' });
  expect((await service.listarPlanes('particular')).map(plan => plan.priceUsd)).toEqual([0]);
  await expect(service.crearCheckout('company-a', 'empresa', { plan: 'empresa', expectedPriceMinor: 2000000 }))
    .rejects.toMatchObject({ codigoEstado: 403 });
  for (let i = 0; i < 3; i++) await firestore.runTransaction(tx => repository.consumeQuota(tx, 'company-a', 'empresa', 'trabajosPublicados'));
  expect((await repository.entitlements('company-a', 'empresa')).limits.trabajosPublicados).toBe(-1);
  expect(provider.crearPreapprovalMercadoPago).not.toHaveBeenCalled();
});

it('los overrides antiguos no vuelven pagos los perfiles profesionales', async () => {
  env.BILLING_CATALOG_JSON = { profesional: { priceUsd: 99, limits: { trabajosPublicados: 0, propuestasEnviadas: 1, consultasIA: 5, perfilesVisibles: 5 } } };
  await db.collection('users').doc('pro-a').set({ id: 'pro-a', rol: 'profesional', activo: true });
  await expect(service.crearCheckout('pro-a', 'profesional', { plan: 'profesional' })).rejects.toMatchObject({ codigoEstado: 403 });
  expect((await service.listarPlanes('profesional'))[0].priceUsd).toBe(0);
  expect((await repository.entitlements('pro-a', 'profesional')).paid).toBe(false);
  expect(provider.crearPreapprovalMercadoPago).not.toHaveBeenCalled();
});
it.each([undefined, 1, 3500000])('no crea un contrato con importe sin confirmar o distinto: %s', async expectedPriceMinor => {
  await expect(service.crearCheckout('company-a', 'empresa', { plan: 'empresa', expectedPriceMinor })).rejects.toMatchObject({ codigoEstado: 409 });
  expect(provider.crearPreapprovalMercadoPago).not.toHaveBeenCalled();
  expect([...db.documents.keys()].filter(k => k.startsWith('subscriptions/'))).toHaveLength(0);
});
it('conserva el importe del checkout pendiente y rechaza cambios silenciosos de cotizacion', async () => {
  await service.crearCheckout('company-a', 'empresa', { plan: 'empresa', expectedPriceMinor: 2000000 });
  env.BILLING_USD_TO_ARS = 1200;
  await expect(service.crearCheckout('company-a', 'empresa', { plan: 'empresa', expectedPriceMinor: 2400000 })).rejects.toMatchObject({ codigoEstado: 409 });
  expect(provider.crearPreapprovalMercadoPago).toHaveBeenCalledTimes(1);
});
