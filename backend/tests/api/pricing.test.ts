/** @archivo pricing.test.ts @descripcion API real con repositorio aislado: tenant, cache, auditoria y flujo. */
import express from 'express';
import type { Server } from 'node:http';
import type { Request, Response, NextFunction } from 'express';
import { jobsRoutes } from '../../src/routes/jobs.routes';
import { firestore } from '../../src/integrations/firebase/admin';
import { geminiClient } from '../../src/integrations/gemini/gemini.client';
import { pricingRepository } from '../../src/repositories/pricing.repository';
import { env } from '../../src/config/env';
import { MemoryFirestore } from '../intake-fixtures';
import { matchingJob, matchingProfessional } from '../matching-fixtures';
import { pricingInputs, pricingQuote } from '../pricing-fixtures';
import type { PricingView } from '../../../shared/pricing';
jest.mock('../../src/integrations/firebase/admin', () => ({ firestore: new (jest.requireActual('../intake-fixtures').MemoryFirestore)() }));
jest.mock('../../src/config/firebase', () => ({ getAuth: () => ({ verifyIdToken: async (token: string) => {
  if (!['company-a', 'company-b', 'professional'].includes(token)) throw new Error('invalid'); return { uid: token };
} }) }));
jest.mock('../../src/middleware/rateLimit.middleware', () => ({ limitadorIA: (_req: Request, _res: Response, next: NextFunction) => next() }));
const db = firestore as unknown as MemoryFirestore;
let server: Server; let url: string;
const base = '/jobs/job-matching/pricing';
/** Peticion HTTP que conserva la autenticacion real de la API. */
async function call(path = base, method = 'GET', body?: unknown, token = 'company-a') {
  const response = await fetch(url + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() as { datos: PricingView; mensaje: string } };
}
/** Inputs y presupuesto como los registra una empresa. */
async function prepare() {
  await call(base + '/inputs', 'PUT', { revision: 0, inputs: pricingInputs() });
  await call(base + '/quotes', 'POST', { revision: 1, quote: pricingQuote() });
}
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/jobs', jobsRoutes);
  await new Promise<void>(resolve => { server = app.listen(0, resolve); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('port');
  url = 'http://127.0.0.1:' + address.port;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
beforeEach(async () => {
  db.clear(); env.GEMINI_PRICING_ENABLED = true;
  for (const uid of ['company-a', 'company-b', 'professional']) {
    await db.collection('users').doc(uid).set({ id: uid, activo: true, rol: uid === 'professional' ? 'profesional' : 'empresa' });
    if (uid !== 'professional') await db.collection('companies').doc('company-' + uid).set({ id: 'company-' + uid, usuarioId: uid, activo: true });
  }
  await db.collection('jobs').doc('job-matching').set({ ...matchingJob({ urgency: 'normal' }) });
  jest.spyOn(geminiClient, 'estaDisponible').mockReturnValue(true);
  jest.spyOn(geminiClient, 'generarEstructurado').mockImplementation(async (system, prompt) => {
    if (system.includes('Pricing')) return { summary: 'Las referencias corresponden al alcance indicado.', evidenceIds: ['e0'], questions: [], cautions: [] };
    const data = JSON.parse(prompt) as { candidates: Array<{ professionalId: string }> };
    return { matches: data.candidates.map(c => ({ professionalId: c.professionalId, semanticScore: 90, reason: 'Categoria y experiencia compatibles.', strengths: [], concerns: [], recommended: true })) };
  });
});
afterEach(() => jest.restoreAllMocks());
it('autentica todos los endpoints y niega otros roles y tenants', async () => {
  for (const [path, method, body] of [[base, 'GET', undefined], [base, 'POST', {}], [base + '/inputs', 'PUT', { revision: 0, inputs: pricingInputs() }], [base + '/quotes', 'POST', { revision: 0, quote: pricingQuote() }]] as const) {
    expect((await call(path, method, body, '')).status).toBe(401);
    expect((await call(path, method, body, 'professional')).status).toBe(403);
    expect((await call(path, method, body, 'company-b')).status).toBe(404);
  }
});
it('informa datos insuficientes, audita y no usa presupuesto deseado como estimacion', async () => {
  const original = db.documents.get('jobs/job-matching');
  const result = await call(base, 'POST', {});
  expect(result.status).toBe(200); expect(result.body.datos.result).toMatchObject({ status: 'insufficient_data', range: null });
  expect(geminiClient.generarEstructurado).not.toHaveBeenCalled(); expect(db.documents.get('jobs/job-matching')).toEqual(original);
  expect([...db.documents.keys()].filter(k => k.includes('/pricing_estimates/'))).toHaveLength(1);
});
it('estima con referencias, reutiliza cache, conserva auditoria y registra analytics', async () => {
  await prepare(); const first = await call(base, 'POST', {});
  expect(first.status).toBe(200); expect(first.body.datos.result?.range?.central).toBe(10000);
  expect((await call(base, 'POST', {})).body.datos.result?.id).toBe(first.body.datos.result?.id);
  expect(geminiClient.generarEstructurado).toHaveBeenCalledTimes(1);
  expect([...db.documents.values()].some(d => d.tipo === 'pricing_completed')).toBe(true);
  expect(first.body.datos.history).toHaveLength(1); expect(JSON.stringify(first.body)).not.toContain('fingerprint');
});
it('invalida cambios de alcance y Job, y respeta revision', async () => {
  await prepare(); const first = (await call(base, 'POST', {})).body.datos;
  expect((await call(base + '/inputs', 'PUT', { revision: 0, inputs: pricingInputs() })).status).toBe(409);
  await call(base + '/inputs', 'PUT', { revision: 2, inputs: pricingInputs({ quantity: 8 }) });
  expect((await call()).body.datos).toMatchObject({ stale: true, result: null });
  const second = (await call(base, 'POST', {})).body.datos;
  expect(second.result?.range?.central).toBe(20000); expect(second.result?.id).not.toBe(first.result?.id);
  await db.collection('jobs').doc('job-matching').update({ descripcion: 'Alcance modificado' });
  expect((await call()).body.datos.stale).toBe(true);
});
it('presupuesto idempotente; no permite cambiarlo usando el mismo ID', async () => {
  await prepare(); expect((await call(base + '/quotes', 'POST', { revision: 1, quote: pricingQuote() })).status).toBe(200);
  expect((await call()).body.datos.quotes).toHaveLength(1);
  expect((await call(base + '/quotes', 'POST', { revision: 2, quote: pricingQuote(0, { amount: 20 }) })).status).toBe(409);
});
it('mantiene evidencia al fallar Gemini y oculta errores internos', async () => {
  await prepare(); jest.mocked(geminiClient.generarEstructurado).mockRejectedValue(new Error('PRIVATE_KEY=secret'));
  const response = await call(base, 'POST', {});
  expect(response.body.datos.result).toMatchObject({ fallbackUsed: true, range: { central: 10000 } });
  expect(JSON.stringify(response.body)).not.toContain('PRIVATE_KEY');
});
it('no persiste resultados si cambia el Job durante Gemini', async () => {
  await prepare();
  jest.mocked(geminiClient.generarEstructurado).mockImplementation(async () => {
    await db.collection('jobs').doc('job-matching').update({ descripcion: 'Cambio concurrente' });
    return { summary: 'Descripcion valida del analisis realizado.', evidenceIds: ['e0'], questions: [], cautions: [] };
  });
  expect((await call(base, 'POST', {})).status).toBe(409);
  expect([...db.documents.keys()].filter(k => k.includes('/pricing_estimates/'))).toHaveLength(0);
});
it('rechaza fechas imposibles, parametros y campos no permitidos', async () => {
  expect((await call('/jobs/missing/pricing')).status).toBe(404);
  expect((await call('/jobs/bad%2Fid/pricing')).status).toBe(400);
  expect((await call(base, 'POST', { force: true })).status).toBe(400);
  expect((await call(base + '/quotes', 'POST', { revision: 0, quote: pricingQuote(0, { validUntil: '2026-02-30' }) })).status).toBe(400);
});
it('propaga error de repositorio con mensaje seguro', async () => {
  jest.spyOn(pricingRepository, 'evidence').mockRejectedValue(new Error('secret database connection'));
  const result = await call(); expect(result.status).toBe(503); expect(JSON.stringify(result.body)).not.toContain('secret');
});
it('Matching continua a Pricing sin sobrescribir el presupuesto', async () => {
  await db.collection('professionals').doc('pro-electrician').set({ ...matchingProfessional() });
  const original = db.documents.get('jobs/job-matching')?.presupuestoMaximo;
  expect((await call('/jobs/job-matching/matching', 'POST', {})).status).toBe(200);
  expect((await call()).body.datos.result?.status).toBe('insufficient_data');
  expect(db.documents.get('jobs/job-matching')?.presupuestoMaximo).toBe(original);
});
it('usa solo historicos compatibles propios con terminos completos', async () => {
  await call(base + '/inputs', 'PUT', { revision: 0, inputs: pricingInputs() });
  await db.collection('jobs').doc('completed').set({ ...matchingJob(), estado: 'completado', id: 'completed' });
  const q = pricingQuote(); const terms = { scope: q.scope, unit: q.unit, quantity: q.quantity, materials: q.materials, taxes: q.taxes, validUntil: q.validUntil };
  await db.collection('proposals').doc('historical').set({ trabajoId: 'completed', empresaId: 'company-company-a', precioOfertado: 8000, moneda: 'ARS', estado: 'aceptada', fechaEnvio: new Date(), pricingTerms: terms });
  await db.collection('proposals').doc('other-tenant').set({ trabajoId: 'completed', empresaId: 'company-company-b', precioOfertado: 1, moneda: 'ARS', estado: 'aceptada', fechaEnvio: new Date(), pricingTerms: terms });
  expect((await call(base, 'POST', {})).body.datos.result).toMatchObject({ basis: 'history', evidenceCount: 1, range: { central: 8000 } });
});

it('tarifas reales requieren cobertura declarada, moneda compatible y candidato activo', async () => {
  await db.collection('professionals').doc('pro-electrician').set({ ...matchingProfessional({ tarifaHora: 3000 }),
    tarifaHoraMateriales: 'excluded', tarifaHoraImpuestos: 'excluded', tarifaHoraActualizadaAt: new Date() });
  await call('/jobs/job-matching/matching', 'POST', {});
  await call(base + '/inputs', 'PUT', { revision: 0, inputs: pricingInputs() });
  expect((await call(base, 'POST', {})).body.datos.result).toMatchObject({ basis: 'rate', range: { central: 12000 } });
  await db.collection('professionals').doc('pro-electrician').update({ tarifaHora: 4000 });
  expect((await call()).body.datos.stale).toBe(true);
  expect((await call(base, 'POST', {})).body.datos.result?.range?.central).toBe(16000);
  await db.collection('professionals').doc('pro-electrician').update({ status: 'suspended' });
  expect((await call(base, 'POST', {})).body.datos.result?.range).toBeNull();
});
it('no supone impuestos ni materiales en tarifas legacy', async () => {
  await db.collection('professionals').doc('pro-electrician').set({ ...matchingProfessional({ tarifaHora: 3000 }) });
  await call('/jobs/job-matching/matching', 'POST', {});
  await call(base + '/inputs', 'PUT', { revision: 0, inputs: pricingInputs() });
  expect((await call(base, 'POST', {})).body.datos.result?.range).toBeNull();
});
it('lease evita dos llamadas a Gemini para la misma revision', async () => {
  await prepare(); let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  jest.mocked(geminiClient.generarEstructurado).mockImplementation(async () => {
    await gate; return { summary: 'Las referencias corresponden al alcance indicado.', evidenceIds: ['e0'], questions: [], cautions: [] };
  });
  const first = call(base, 'POST', {});
  for (let i = 0; i < 100 && !jest.mocked(geminiClient.generarEstructurado).mock.calls.length; i++) await new Promise(resolve => setTimeout(resolve, 10));
  const concurrent = await call(base, 'POST', {});
  release(); const completed = await first;
  expect(concurrent.body.datos.processing).toBe(true); expect(completed.status).toBe(200);
  expect(geminiClient.generarEstructurado).toHaveBeenCalledTimes(1);
});
it('respeta vencimiento, TTL y estados cerrados', async () => {
  await prepare(); await call(base, 'POST', {});
  const ref = db.collection('jobs/job-matching/pricing').doc('current');
  const run = (await ref.get()).data()!;
  const result = run.result as Record<string, unknown>;
  await ref.update({ result: { ...result, expiresAt: '2000-01-01' } });
  expect((await call()).body.datos.stale).toBe(true);
  await db.collection('jobs').doc('job-matching').update({ estado: 'completado' });
  expect((await call(base, 'POST', {})).status).toBe(409);
  expect((await call(base + '/quotes', 'POST', { revision: 2, quote: pricingQuote(1) })).status).toBe(409);
});
