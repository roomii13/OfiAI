/**
 * @archivo matching.test.ts
 * @descripcion HTTP, servicio y repositorios reales sobre Firestore transaccional aislado.
 */
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { Server } from 'http';
import { jobsRoutes } from '../../src/routes/jobs.routes';
import { errorMiddleware } from '../../src/middleware/error.middleware';
import { firestore } from '../../src/integrations/firebase/admin';
import { geminiClient } from '../../src/integrations/gemini/gemini.client';
import { professionalRepository } from '../../src/repositories/professional.repository';
import { env } from '../../src/config/env';
import { MemoryFirestore } from '../intake-fixtures';
import { matchingJob, matchingProfessional, matchingCatalog } from '../matching-fixtures';
import type { MatchingResult } from '../../../shared/matching';
jest.mock('../../src/integrations/firebase/admin', () => ({ firestore: new (jest.requireActual('../intake-fixtures').MemoryFirestore)() }));
jest.mock('../../src/config/firebase', () => ({
  getAuth: () => ({ verifyIdToken: async (token: string) => {
    if (!['company-a', 'company-b', 'professional', 'admin'].includes(token)) throw new Error('invalid');
    return { uid: token, email: token + '@example.test' };
  } }),
}));
jest.mock('../../src/middleware/rateLimit.middleware', () => ({
  limitadorIA: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
const db = firestore as unknown as MemoryFirestore;
let server: Server; let url: string;
const path = '/jobs/job-matching';
const providerConfig = { GROQ_API_KEY: env.GROQ_API_KEY, GROQ_MODEL: env.GROQ_MODEL,
  AI_LEGACY_FALLBACK_ENABLED: env.AI_LEGACY_FALLBACK_ENABLED };
/** Solicitud autenticada a Express, no invocacion directa de controller. */
async function call(endpoint: string, body?: unknown, token = 'company-a') {
  const response = await fetch(url + endpoint, { method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() as { datos: MatchingResult; mensaje?: string; stack?: string } };
}
/** Respuesta sintetica para los IDs realmente enviados al proveedor. */
async function semantic(_system: string, prompt: string): Promise<unknown> {
  const data = JSON.parse(prompt) as { candidates: Array<{ professionalId: string }> };
  return { matches: data.candidates.map(row => ({ professionalId: row.professionalId, semanticScore: 90, reason: 'Habilidades declaradas compatibles.',
    strengths: ['Experiencia relevante declarada'], concerns: [], recommended: true })) };
}
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/jobs', jobsRoutes); app.use(errorMiddleware);
  await new Promise<void>(resolve => { server = app.listen(0, resolve); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Puerto invalido');
  url = 'http://127.0.0.1:' + address.port;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
beforeEach(async () => {
  db.clear(); env.GEMINI_MATCHING_ENABLED = true;
  for (const id of ['company-a', 'company-b', 'professional', 'admin']) {
    await db.collection('users').doc(id).set({ id, nombre: 'Demo', activo: true, rol: id === 'professional' ? 'profesional' : id === 'admin' ? 'admin' : 'empresa' });
    if (id.startsWith('company')) await db.collection('companies').doc('company-' + id).set({ id: 'company-' + id, usuarioId: id, activo: true });
  }
  await db.collection('jobs').doc('job-matching').set({ ...matchingJob() });
  for (const pro of [...matchingCatalog(), matchingProfessional(), matchingProfessional({ id: 'far', radioServicioKm: undefined, ciudad: 'Otra ciudad', aniosExperiencia: 2, coordenadas: { latitud: -37.35, longitud: -64.29 } }),
    matchingProfessional({ id: 'inactive', status: 'inactive' }), matchingProfessional({ id: 'suspended', status: 'suspended' })]) {
    await db.collection('professionals').doc(pro.id).set({ ...pro, email: 'privado@example.test', telefono: '+5492954000000', documentosPrivados: ['secret'] });
  }
  jest.spyOn(geminiClient, 'estaDisponible').mockReturnValue(true);
  jest.spyOn(geminiClient, 'generarEstructurado').mockImplementation(semantic);
});
afterEach(() => { jest.restoreAllMocks(); Object.assign(env, providerConfig); });
it.each(['activation', 'model', 'fallback'] as const)('invalida cache al cambiar proveedor: %s', async change => {
  const first = (await call(path + '/matching', {})).body.datos;
  if (change === 'activation') env.GROQ_API_KEY = 'test-key-not-a-secret';
  if (change === 'model') env.GROQ_MODEL = 'test-model-v2';
  if (change === 'fallback') env.AI_LEGACY_FALLBACK_ENABLED = !env.AI_LEGACY_FALLBACK_ENABLED;
  expect((await call(path + '/matches')).body.datos.status).toBe('pending');
  const next = (await call(path + '/matching', {})).body.datos;
  expect(next.cached).toBe(false); expect(next.runId).not.toBe(first.runId);
  expect(geminiClient.generarEstructurado).toHaveBeenCalledTimes(2);
});
it('requiere autenticacion y rol empresa en POST/GET/perfil/seleccion', async () => {
  for (const endpoint of ['/matching', '/matches', '/matches/pro-electrician/profile', '/matches/pro-electrician/select']) {
    const body = endpoint.endsWith('/matching') || endpoint.endsWith('/select') ? {} : undefined;
    expect((await call(path + endpoint, body, '')).status).toBe(401);
    expect((await call(path + endpoint, body, 'professional')).status).toBe(403);
    expect((await call(path + endpoint, body, 'admin')).status).toBe(403);
    expect((await call(path + endpoint, endpoint.endsWith('/select') ? { runId: '69ceef91-71a4-46b2-8ab8-c9b4902c26c6' } : body, 'company-b')).status).toBe(404);
  }
  expect(geminiClient.generarEstructurado).not.toHaveBeenCalled();
});
it('valida Job existente, parametros y payloads antes de usar Gemini', async () => {
  expect((await call('/jobs/missing/matching', {})).status).toBe(404);
  expect((await call('/jobs/bad%2Fid/matching', {})).status).toBe(400);
  expect((await call(path + '/matching', { companyId: 'other' })).status).toBe(400);
  expect((await call(path + '/matches/pro-electrician/select', { runId: 'invalido' })).status).toBe(400);
  await db.collection('jobs').doc('job-matching').update({ descripcion: '' });
  expect((await call(path + '/matching', {})).status).toBe(400);
  expect(geminiClient.generarEstructurado).not.toHaveBeenCalled();
});
it('filtra candidatos, ordena, persiste y devuelve solo datos publicos', async () => {
  expect((await call(path + '/matches')).body.datos.status).toBe('pending');
  const result = await call(path + '/matching', {});
  expect(result.status).toBe(200);
  expect(result.body.datos).toMatchObject({ status: 'completed', semanticMatchingUsed: true, totalCandidates: 3, completedStages: 5 });
  expect(result.body.datos.matches[0].professionalId).toBe('pro-electrician');
  expect(result.body.datos.matches.some(row => ['inactive', 'suspended', 'fixture-8'].includes(row.professionalId))).toBe(false);
  const serialized = JSON.stringify(result.body);
  for (const value of ['private-user-id', 'documentosPrivados', 'privado@example.test', 'coordenadas', 'profileVersions', 'jobFingerprint']) expect(serialized).not.toContain(value);
  expect(db.documents.has('jobs/job-matching/matching/current')).toBe(true);
  expect([...db.documents.keys()].filter(key => key.startsWith('jobs/job-matching/matches/'))).toHaveLength(3);
});
it('reutiliza cache tanto al abrir como al ejecutar; registra vistas idempotentes', async () => {
  const first = (await call(path + '/matching', {})).body.datos;
  expect((await call(path + '/matching', {})).body.datos).toMatchObject({ cached: true, runId: first.runId });
  expect((await call(path + '/matches')).body.datos.matches).toHaveLength(3);
  expect(geminiClient.generarEstructurado).toHaveBeenCalledTimes(1);
  for (let i = 0; i < 2; i++) expect((await call(path + '/matches/events', { type: 'match_viewed', runId: first.runId })).status).toBe(200);
  expect([...db.documents.values()].filter(value => value.tipo === 'match_viewed')).toHaveLength(1);
});
it('invalida TTL, cambios de Job y cambios de profesional', async () => {
  const first = (await call(path + '/matching', {})).body.datos;
  await db.collection('professionals').doc('pro-electrician').update({ status: 'suspended' });
  expect((await call(path + '/matches')).body.datos).toMatchObject({ status: 'pending', matches: [] });
  expect((await call(path + '/matches/pro-electrician/select', { runId: first.runId })).status).toBe(409);
  const next = (await call(path + '/matching', {})).body.datos;
  expect(next.runId).not.toBe(first.runId); expect(next.matches.some(row => row.professionalId === 'pro-electrician')).toBe(false);
  await db.collection('jobs').doc('job-matching').update({ titulo: 'Nueva necesidad electrica' });
  expect((await call(path + '/matches')).body.datos.status).toBe('pending');
  await call(path + '/matching', {});
  await db.collection('jobs/job-matching/matching').doc('current').update({ expiresAt: '2000-01-01T00:00:00Z' });
  expect((await call(path + '/matches')).body.datos.status).toBe('pending');
});
it('sin profesionales devuelve vacio, no llama a Gemini y no inventa perfiles', async () => {
  for (const key of db.documents.keys()) if (key.startsWith('professionals/')) db.documents.delete(key);
  const result = await call(path + '/matching', {});
  expect(result.body.datos).toMatchObject({ status: 'completed', matches: [], totalCandidates: 0, fallbackUsed: false });
  expect(geminiClient.generarEstructurado).not.toHaveBeenCalled();
});
it('fallback persiste ranking determinista y metricas cuando Gemini falla', async () => {
  jest.mocked(geminiClient.generarEstructurado).mockRejectedValueOnce(new Error('internal-secret'));
  const result = await call(path + '/matching', {});
  expect(result.body.datos).toMatchObject({ status: 'fallback', semanticMatchingUsed: false, fallbackUsed: true });
  expect(result.body.datos.matches[0].matchScore).toBe(100);
  expect(JSON.stringify(result.body)).not.toContain('internal-secret');
  const event = [...db.documents.values()].find(value => value.tipo === 'matching_fallback_used');
  expect(event?.metadata).toMatchObject({ fallback_used: true, candidates_found: 3, matches_returned: 3 });
});
it('perfil contextual y seleccion atomica no contratan ni modifican estado comercial', async () => {
  const run = (await call(path + '/matching', {})).body.datos;
  expect((await call(path + '/matches/fixture-8/profile')).status).toBe(404);
  expect((await call(path + '/matches/pro-electrician/profile')).status).toBe(200);
  for (let i = 0; i < 2; i++) {
    const result = await call(path + '/matches/pro-electrician/select', { runId: run.runId });
    expect(result.status).toBe(200); expect(result.body.datos.selectedProfessionalId).toBe('pro-electrician');
  }
  const job = db.documents.get('jobs/job-matching');
  expect(job).toMatchObject({ estado: 'publicado', matchingSelection: { status: 'selected', professionalId: 'pro-electrician' } });
  expect(job?.profesionalAsignadoId).toBeUndefined();
  expect([...db.documents.values()].filter(value => value.tipo === 'professional_selected')).toHaveLength(1);
  expect((await call(path + '/matches/far/select', { runId: run.runId })).status).toBe(200);
  expect(db.documents.get('jobs/job-matching/matches/pro-electrician')?.state).toBe('recommended');
});
it('deduplica solicitudes concurrentes mediante lease', async () => {
  let finish: (() => void) | undefined;
  jest.mocked(geminiClient.generarEstructurado).mockImplementationOnce((system, prompt) => new Promise(resolve => {
    finish = () => { void semantic(system, prompt).then(resolve); };
  }));
  const first = call(path + '/matching', {});
  while (!finish) await new Promise(resolve => setTimeout(resolve, 5));
  const second = await call(path + '/matching', {});
  expect(second.body.datos.status).toBe('processing'); finish();
  expect((await first).body.datos.status).toBe('completed');
  expect(geminiClient.generarEstructurado).toHaveBeenCalledTimes(1);
});
it('fallos internos quedan registrados sin exponer detalles ni borrar el Job', async () => {
  jest.spyOn(professionalRepository, 'findMatchingCandidates').mockRejectedValueOnce(new Error('private database trace'));
  const result = await call(path + '/matching', {});
  expect(result.status).toBe(503); expect(result.body.stack).toBeUndefined();
  expect(JSON.stringify(result.body)).not.toContain('private database trace');
  expect(db.documents.get('jobs/job-matching')?.matchingStatus).toBe('failed');
});
it('crear un Job publicado dispara matching sin notificaciones ni contratacion', async () => {
  const result = await call('/jobs', { titulo: 'Nuevo trabajo electrico', descripcion: 'Revisar el tablero electrico del edificio.', categoria: 'Electricidad', ciudad: 'Santa Rosa', tipoTrabajo: 'presencial' });
  expect(result.status).toBe(201);
  const jobs = [...db.documents.entries()].filter(([key]) => /^jobs\/[^/]+$/.test(key));
  expect(jobs).toHaveLength(2);
  const created = jobs.find(([key]) => key !== 'jobs/job-matching')?.[1];
  expect(created?.matchingStatus).toBe('completed');
  expect([...db.documents.keys()].some(key => key.startsWith('notifications/'))).toBe(false);
});
