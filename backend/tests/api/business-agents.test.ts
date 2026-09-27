/** @archivo business-agents.test.ts @descripcion Fronteras HTTP de operaciones con identidad sintetica y Firestore aislado. */
import express from 'express';
import type { Server } from 'node:http';
import { salesRoutes } from '../../src/routes/sales.routes';
import { marketingRoutes } from '../../src/routes/marketing.routes';
import { supportRoutes } from '../../src/routes/support.routes';
import { knowledgeRoutes } from '../../src/routes/knowledge.routes';
import { intelligenceRoutes } from '../../src/routes/intelligence.routes';
import { orchestratorRoutes } from '../../src/routes/orchestrator.routes';
import { governanceRoutes } from '../../src/routes/governance.routes';
import { firestore } from '../../src/integrations/firebase/admin';
import { MemoryFirestore } from '../intake-fixtures';
import { supportService } from '../../src/services/support.service';
jest.mock('../../src/integrations/firebase/admin', () => ({ firestore: new (jest.requireActual('../intake-fixtures').MemoryFirestore)() }));
jest.mock('../../src/config/firebase', () => ({ getAuth: () => ({ verifyIdToken: async (token: string) => {
  if (!['company','admin','suspended','forged'].includes(token)) throw new Error('invalid');
  return { uid: token, rol: 'admin' };
} }) }));
let server: Server; let base: string;
const db = firestore as unknown as MemoryFirestore;
/** Usa HTTP local real; el token solo es valido dentro del doble de Firebase de este archivo. */
async function call(path: string, token = '', body?: unknown) {
  const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() as { datos?: unknown; mensaje?: string } };
}
beforeAll(async () => {
  const app = express(); app.use(express.json());
  app.use('/sales', salesRoutes); app.use('/marketing', marketingRoutes); app.use('/support', supportRoutes);
  app.use('/knowledge', knowledgeRoutes); app.use('/intelligence', intelligenceRoutes); app.use('/agents', orchestratorRoutes);
  app.use('/governance', governanceRoutes);
  await new Promise<void>(resolve => { server = app.listen(0, resolve); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('port');
  base = 'http://127.0.0.1:' + address.port;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
beforeEach(async () => {
  db.clear();
  for (const uid of ['company','admin','suspended','forged']) await db.collection('users').doc(uid)
    .set({ id: uid, rol: uid === 'admin' ? 'admin' : 'empresa', activo: uid !== 'suspended' });
});
afterEach(() => jest.restoreAllMocks());
it.each(['/sales/me','/sales/leads','/marketing','/support/sessions','/support/tickets',
  '/knowledge','/intelligence','/agents/runs','/governance'])('exige autenticacion en %s', async path => {
  expect((await call(path)).status).toBe(401);
});
it.each(['/sales/leads','/marketing','/support/tickets','/governance'])('deniega rol empresa y claim admin falsificado en %s', async path => {
  expect((await call(path,'company')).status).toBe(403);
  expect((await call(path,'forged')).status).toBe(403);
});
it('rechaza cuenta suspendida y token invalido', async () => {
  expect((await call('/support/sessions','suspended')).status).toBe(403);
  expect((await call('/support/sessions','invalid')).status).toBe(401);
});
it('rechaza herramientas arbitrarias y ownership inyectado', async () => {
  expect((await call('/support/sessions','company',{ resource: { tool: 'deleteCollection', id: 'users' } })).status).toBe(400);
  expect((await call('/support/sessions','company',{ resource: null, ownerId: 'admin' })).status).toBe(400);
  expect((await call('/agents/runs','company',{ event: 'delete.all', requestId: 'not-a-uuid' })).status).toBe(400);
});
it('oculta sesiones ajenas antes de exponer mensajes', async () => {
  await db.collection('support_sessions').doc('session-a').set({ id: 'session-a', ownerId: 'admin', messages: ['private'] });
  const response = await call('/support/sessions/session-a','company');
  expect(response.status).toBe(404); expect(JSON.stringify(response.body)).not.toContain('private');
});
it('devuelve error amigable sin filtrar cuerpos del proveedor ni stack', async () => {
  jest.spyOn(supportService,'list').mockRejectedValue(new Error('secret-provider-body'));
  const response = await call('/support/sessions','company');
  expect(response.status).toBe(503); expect(JSON.stringify(response.body)).not.toContain('secret-provider-body');
  expect(response.body.mensaje).toBe('No pudimos completar la operacion. Intenta nuevamente.');
});
