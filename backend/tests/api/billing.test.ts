/** @archivo billing.test.ts @descripcion Endpoints HTTP reales con Firebase aislado y sin consultas al proveedor. */
import express from 'express';
import type { Server } from 'node:http';
import { subscriptionRoutes } from '../../src/routes/subscriptions.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { firestore } from '../../src/integrations/firebase/admin';
import { MemoryFirestore } from '../intake-fixtures';
import { env } from '../../src/config/env';
jest.mock('../../src/integrations/firebase/admin', () => ({ firestore: new (jest.requireActual('../intake-fixtures').MemoryFirestore)() }));
jest.mock('../../src/config/firebase', () => ({ getAuth: () => ({ verifyIdToken: async (token: string) => {
  if (!['company-a', 'company-b', 'admin'].includes(token)) throw new Error('invalid');
  return { uid: token };
} }) }));
const db = firestore as unknown as MemoryFirestore;
let server: Server; let url: string;
/** Realiza HTTP sin sustituir controladores, validadores ni permisos. */
async function request(path: string, token = 'company-a', method = 'GET', data?: unknown) {
  const response = await fetch(url + '/subscriptions' + path, { method, headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  return { status: response.status, body: await response.json() as { datos: unknown } };
}
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/subscriptions', subscriptionRoutes); app.use(errorMiddleware);
  await new Promise<void>(resolve => { server = app.listen(0, resolve); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('port');
  url = 'http://127.0.0.1:' + address.port;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
beforeEach(async () => {
  db.clear(); env.MERCADOPAGO_WEBHOOK_SECRET = 'test-only';
  for (const uid of ['company-a', 'company-b', 'admin']) await db.collection('users').doc(uid).set({
    id: uid, email: uid + '@example.test', rol: uid === 'admin' ? 'admin' : 'empresa', activo: true,
  });
  const now = new Date();
  await db.collection('subscriptions').doc('sub-b').set({
    id: 'sub-b', usuarioId: 'company-b', rolUsuario: 'empresa', plan: 'gratuito', estado: 'activa',
    fechaInicio: now, fechaVencimiento: now, fechaCreacion: now, fechaActualizacion: now, precioMensual: 0, moneda: 'ARS',
    renovacionAutomatica: false, limitesActuales: { consultasIA: 5, perfilesVisibles: 5 },
  });
});
it('permite catalogo por audiencia sin exponer configuracion privada', async () => {
  const result = await request('/plans?audience=empresa', '');
  expect(result.status).toBe(200); expect(result.body.datos).toHaveLength(4);
  expect(JSON.stringify(result.body)).not.toContain('test-only');
});
it('exige autenticacion para datos financieros', async () => {
  expect((await request('/billing', '')).status).toBe(401);
  expect((await request('/history', '')).status).toBe(401);
  expect((await request('/checkout', '', 'POST', { plan: 'gratuito' })).status).toBe(401);
});
it('aun autenticada una empresa no accede a revenue ni contratos ajenos', async () => {
  expect((await request('/revenue?month=2026-09')).status).toBe(403);
  expect((await request('/sub-b/cancel', 'company-a', 'POST', {})).status).toBe(404);
  expect((await request('/sub-b/renew', 'company-a', 'POST', {})).status).toBe(404);
  expect((await request('/sub-b/change-plan', 'company-a', 'POST', { plan: 'empresa' })).status).toBe(404);
  expect((await request('/revenue?month=2026-09', 'admin')).body.datos).toEqual([]);
});
it('rechaza ids, importes o identidad inyectados desde el cliente', async () => {
  expect((await request('/bad%2Fid/renew', 'company-a', 'POST', {})).status).toBe(400);
  expect((await request('/checkout', 'company-a', 'POST', { plan: 'gratuito', usuarioId: 'company-b', precioMensual: 0 })).status).toBe(400);
  expect((await request('/revenue?month=2026-99', 'admin')).status).toBe(400);
});
it('webhook sin firma no activa contratos', async () => {
  expect((await request('/webhooks/mercadopago?data.id=123', '', 'POST',
    { type: 'subscription_authorized_payment', data: { id: '123' } })).status).toBe(401);
});
it('cuenta sin pagos solo recibe FREE y ninguna compra nativa ficticia', async () => {
  const result = await request('/billing');
  expect(result.body.datos).toMatchObject({ entitlements: { plan: 'gratuito', paid: false }, payments: [],
    stores: { purchasesEnabled: false }, transactionFee: { collectionEnabled: false } });
});
