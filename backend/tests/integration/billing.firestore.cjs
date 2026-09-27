/** @archivo billing.firestore.cjs @descripcion Ledger y cuotas con SDK real, EXCLUSIVAMENTE Firestore Emulator local. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const host = process.argv[2];
assert.match(host ?? '', /^127\.0\.0\.1:\d+$/);
process.env.NODE_ENV = 'test'; process.env.FIRESTORE_EMULATOR_HOST = host;
process.env.FIREBASE_PROJECT_ID = 'demo-ofiai-billing'; process.env.FIREBASE_DATABASE_ID = '(default)';
process.env.FIREBASE_CLIENT_EMAIL = ''; process.env.FIREBASE_PRIVATE_KEY = ''; process.env.SCHEDULER_ENABLED = 'false';
const { getFirestore, getFirebaseApp } = require('../../dist/config/firebase');
const { SubscriptionRepository } = require('../../dist/repositories/subscription.repository');
const { deleteApp } = require('firebase-admin/app');
const db = getFirestore(); const repo = new SubscriptionRepository(db);
/** Prueba carreras reales, conversion Timestamp, deduplicacion, reintegro y reglas de cuotas del backend. */
async function main() {
  const id = 'billing-qa-' + randomUUID(), now = new Date(), uid = id + '-user';
  await repo.createForAccount({ id, usuarioId: uid, rolUsuario: 'empresa', plan: 'empresa', estado: 'pendiente_pago',
    precioMensual: 35000, moneda: 'ARS', fechaInicio: now, fechaVencimiento: now, renovacionAutomatica: true,
    fechaCreacion: now, fechaActualizacion: now, limitesActuales: { trabajosPublicados: 10, consultasIA: 50, perfilesVisibles: 100 } });
  const payment = { id: randomUUID(), invoiceId: 'invoice-local', amount: 35000, refunded: 0, currency: 'ARS',
    status: 'approved', paidAt: now.toISOString(), periodStart: now.toISOString() };
  await Promise.all(Array.from({ length: 6 }, () => repo.applyPayment(id, payment)));
  assert.equal((await repo.payments(uid)).length, 1);
  assert.equal((await repo.entitlements(uid, 'empresa')).paid, true);
  const until = (await repo.findById(id)).fechaVencimiento.toISOString();
  await repo.applyPayment(id, payment);
  assert.equal((await repo.findById(id)).fechaVencimiento.toISOString(), until);
  assert.equal((await repo.findById(id)).fechaInicio instanceof Date, true);
  await assert.rejects(repo.applyPayment(id, { ...payment, id: randomUUID(), amount: 1 }), error => error.codigoEstado === 409);
  await repo.applyPayment(id, { ...payment, status: 'refunded', refunded: 35000 });
  assert.equal((await repo.entitlements(uid, 'empresa')).paid, false);
  const freeUid = id + '-free';
  const result = await Promise.allSettled([0, 1].map(() => db.runTransaction(tx => repo.consumeQuota(tx, freeUid, 'empresa', 'trabajosPublicados'))));
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await repo.entitlements(freeUid, 'empresa')).used.trabajosPublicados, 1);
  await db.runTransaction(tx => repo.consumeQuota(tx, id + '-professional', 'profesional', 'propuestasEnviadas', 'proposal-a'));
  await db.runTransaction(tx => repo.consumeQuota(tx, id + '-professional', 'profesional', 'propuestasEnviadas', 'proposal-a'));
  assert.equal((await repo.entitlements(id + '-professional', 'profesional')).used.propuestasEnviadas, 1);
  console.log(JSON.stringify({ billing: 'passed', checks: 9, emulator: host, productionWrites: 0 }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  await db.terminate(); await deleteApp(getFirebaseApp());
});
