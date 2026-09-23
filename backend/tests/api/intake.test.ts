/**
 * @archivo intake.test.ts
 * @descripcion API real Express con repositorios reales, proveedor y Firestore aislados en memoria.
 */
import express from 'express';
import type { Server } from 'http';
import type { NextFunction, Request, Response } from 'express';
import { aiRoutes } from '../../src/routes/ai.routes';
import { jobsRoutes } from '../../src/routes/jobs.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { firestore } from '../../src/integrations/firebase/admin';
import { intakeAgent } from '../../src/ai/agents/intake.agent';
import { GeminiIntakeError } from '../../src/integrations/gemini/gemini.client';
import { assessIntake, emptyIntakeData } from '../../src/ai/tools/intake-state.tool';
import { MemoryFirestore, completeIntakeData } from '../intake-fixtures';

jest.mock('../../src/integrations/firebase/admin', () => ({
  firestore: new (jest.requireActual('../intake-fixtures').MemoryFirestore)(),
}));
jest.mock('../../src/config/firebase', () => ({
  getAuth: () => ({ verifyIdToken: async (token: string) => {
    if (!['company-a', 'company-b', 'professional'].includes(token)) throw new Error('invalid');
    return { uid: token, email: token + '@example.test' };
  } }),
}));
jest.mock('../../src/ai/agents/intake.agent', () => ({ intakeAgent: { conversar: jest.fn(), clasificarSolicitud: jest.fn() } }));
jest.mock('../../src/middleware/rateLimit.middleware', () => ({
  limitadorIA: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

const db = firestore as unknown as MemoryFirestore;
let server: Server;
let url: string;
const sessionId = 'intake-session-12345';
/** Solicita endpoints HTTP con identidades de prueba verificadas por el middleware. */
async function call(path: string, body?: unknown, token = 'company-a') {
  const response = await fetch(url + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() as { exito: boolean; datos: Record<string, unknown>; mensaje?: string; stack?: string } };
}
/** Crea una sesion mediante la API sin publicar un trabajo. */
async function start() { return call('/ai/intake/sessions', { requestId: sessionId }); }
/** Envia un turno completo sintetico al servicio. */
async function complete(version = 0, requestId = 'message-command-1234') {
  return call('/ai/intake/sessions/' + sessionId + '/messages', { requestId, expectedVersion: version, message: 'Reparar humedad en el edificio.' });
}
beforeAll(async () => {
  const app = express(); app.use(express.json());
  app.use('/ai', aiRoutes); app.use('/jobs', jobsRoutes); app.use(errorMiddleware);
  await new Promise<void>(resolve => { server = app.listen(0, resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Puerto invalido');
  url = 'http://127.0.0.1:' + address.port;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
beforeEach(async () => {
  db.clear();
  for (const id of ['company-a', 'company-b', 'professional']) {
    await db.collection('users').doc(id).set({ id, nombre: 'Demo', activo: true, rol: id === 'professional' ? 'profesional' : 'empresa' });
    if (id !== 'professional') await db.collection('companies').doc('company-' + id).set({ id: 'company-' + id, usuarioId: id, activo: true });
  }
  const data = completeIntakeData();
  jest.mocked(intakeAgent.conversar).mockReset().mockResolvedValue({ message: 'Revisa el resumen antes de publicar.', extractedData: data, ...assessIntake(data) });
});
it('requiere autenticacion, rol empresa y cuerpos estrictos', async () => {
  expect((await call('/ai/intake/sessions', undefined, '')).status).toBe(401);
  expect((await call('/ai/intake/sessions', undefined, 'professional')).status).toBe(403);
  expect((await call('/ai/intake/sessions', { requestId: sessionId, companyId: 'ajena' })).status).toBe(400);
});
it('crea una sesion idempotente sin trabajos y la lista solo al propietario', async () => {
  await start(); await start();
  expect([...db.documents.keys()].filter(key => key.startsWith('ai_intake_sessions/'))).toHaveLength(1);
  expect([...db.documents.keys()].filter(key => key.startsWith('jobs/'))).toHaveLength(0);
  expect((await call('/ai/intake/sessions', undefined, 'company-b')).body.datos).toEqual([]);
  expect((await call('/ai/intake/sessions/' + sessionId, undefined, 'company-b')).status).toBe(404);
  expect((await call('/ai/intake/sessions', { requestId: sessionId }, 'company-b')).status).toBe(404);
});
it('mantiene contexto, devuelve JSON estructurado y no repite mensajes por reintento', async () => {
  await start();
  const first = await complete();
  expect(first.body.datos.readyToCreateJob).toBe(true);
  await complete();
  expect(intakeAgent.conversar).toHaveBeenCalledTimes(1);
  await complete(1, 'message-command-5678');
  expect(jest.mocked(intakeAgent.conversar).mock.calls[1][0].messages).toHaveLength(3);
  expect((await call('/ai/intake/sessions/' + sessionId)).body.datos.version).toBe(2);
});
it('solo publica tras confirmacion explicita y crea exactamente un Job con metadata', async () => {
  await start();
  expect((await call('/ai/intake/sessions/' + sessionId + '/confirm', { confirmed: true, expectedVersion: 0 })).status).toBe(409);
  await complete();
  expect((await call('/ai/intake/sessions/' + sessionId + '/confirm', { confirmed: false, expectedVersion: 1 })).status).toBe(400);
  expect((await call('/ai/intake/sessions/' + sessionId + '/confirm', { confirmed: true, expectedVersion: 0 })).status).toBe(409);
  expect((await call('/ai/intake/sessions/' + sessionId + '/confirm', { confirmed: true, expectedVersion: 1 }, 'company-b')).status).toBe(404);
  const results = await Promise.all([1, 2].map(() => call('/ai/intake/sessions/' + sessionId + '/confirm', { confirmed: true, expectedVersion: 1 })));
  expect(results.every(result => result.status === 200)).toBe(true);
  const jobs = [...db.documents.entries()].filter(([key]) => /^jobs\/[^/]+$/.test(key));
  expect(jobs).toHaveLength(1);
  expect(jobs[0][1]).toMatchObject({ source: 'ai_intake', aiIntakeSessionId: sessionId, companyId: 'company-company-a', empresaId: 'company-company-a', status: 'publicado', estado: 'publicado' });
  expect((await call('/jobs')).body.datos).toHaveLength(1);
  expect((await call('/jobs?empresaId=company-company-a', undefined, 'company-b')).body.datos).toEqual([]);
  expect((await call('/jobs/' + results[0].body.datos.jobId, undefined, 'company-b')).status).toBe(403);
});
it.each(['timeout', 'rate_limit', 'invalid_response', 'unavailable'] as const)('conserva estado ante %s y nunca devuelve stack', async reason => {
  await start();
  jest.mocked(intakeAgent.conversar).mockRejectedValueOnce(new GeminiIntakeError(reason));
  const result = await complete();
  expect(result.status).toBe(reason === 'timeout' ? 504 : reason === 'rate_limit' ? 429 : 503);
  expect(result.body.stack).toBeUndefined();
  const recovered = await call('/ai/intake/sessions/' + sessionId);
  expect(recovered.body.datos.version).toBe(0);
  expect(recovered.body.datos.messages).toHaveLength(1);
  expect(recovered.body.datos.pending).toBeUndefined();
  expect((await complete()).status).toBe(200);
});
it('impide turnos simultaneos y bloquea publicaciones si vuelve a faltar informacion', async () => {
  await start();
  let finish: (() => void) | undefined;
  const model = new Promise<Awaited<ReturnType<typeof intakeAgent.conversar>>>(resolve => {
    finish = () => resolve({ message: 'En que ciudad?', extractedData: emptyIntakeData(), ...assessIntake(emptyIntakeData()) });
  });
  jest.mocked(intakeAgent.conversar).mockReturnValueOnce(model);
  const first = complete();
  while (!jest.mocked(intakeAgent.conversar).mock.calls.length) await new Promise(resolve => setTimeout(resolve, 5));
  expect((await complete(0, 'message-concurrent-1234')).status).toBe(409);
  finish?.(); await first;
  expect((await call('/ai/intake/sessions/' + sessionId + '/confirm', { confirmed: true, expectedVersion: 1 })).status).toBe(409);
});
it('registra abandono y eventos sin duplicar contenido privado', async () => {
  await start();
  const result = await call('/ai/intake/sessions/' + sessionId + '/abandon', { expectedVersion: 0 });
  expect(result.body.datos.status).toBe('abandoned');
  expect((await complete(1)).status).toBe(409);
  const events = [...db.documents.entries()].filter(([key]) => key.startsWith('analytics_events/')).map(([, value]) => value);
  expect(events.map(event => event.tipo)).toEqual(['intake_started', 'intake_abandoned']);
  expect(events[1].metadata).toMatchObject({ number_of_messages: 0, missing_information_count: 8 });
  expect(events.some(event => 'messages' in event || 'description' in event)).toBe(false);
});
