/** @archivo coordinator.test.ts @descripcion HTTP, ownership, acuerdos y repositorio real con Firestore aislado en memoria. */
import express, { type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { jobsRoutes } from '../../src/routes/jobs.routes';
import { coordinatorListRoutes } from '../../src/routes/coordinator.routes';
import { firestore } from '../../src/integrations/firebase/admin';
import { coordinatorRepository } from '../../src/repositories/coordinator.repository';
import { pricingService } from '../../src/services/pricing.service';
import { matchingJobFingerprint, matchingProfileFingerprint } from '../../src/domain/matching/matching';
import { MemoryFirestore } from '../intake-fixtures';
import { matchingJob, matchingProfessional } from '../matching-fixtures';
import { pricingQuote } from '../pricing-fixtures';
import type { CoordinatorView, CoordinatorCommand } from '../../../shared/coordinator';
import type { Trabajo } from '../../src/models/Job';
jest.mock('../../src/integrations/firebase/admin', () => ({ firestore: new (jest.requireActual('../intake-fixtures').MemoryFirestore)() }));
jest.mock('../../src/config/firebase', () => ({ getAuth: () => ({ verifyIdToken: async (token: string) => {
  if (!['company-a', 'company-b', 'professional-a', 'professional-b', 'admin'].includes(token)) throw new Error('invalid');
  return { uid: token };
} }) }));
jest.mock('../../src/middleware/rateLimit.middleware', () => ({ limitadorIA: (_req: Request, _res: Response, next: NextFunction) => next() }));
const db = firestore as unknown as MemoryFirestore;
const base = '/jobs/job-matching/coordinator';
let server: Server; let url: string;
/** HTTP real; solo se sustituye el transporte Firebase por su doble de pruebas. */
async function call(path = base, method = 'GET', body?: unknown, token = 'company-a') {
  const response = await fetch(url + path, { method, headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() as { datos: CoordinatorView; mensaje: string } };
}
/** Preparacion de seleccion vigente, equivalente a Matching ya confirmado. */
async function selection() {
  const job = db.documents.get('jobs/job-matching') as unknown as Trabajo;
  const professional = matchingProfessional({ usuarioId: 'professional-a' });
  const selected = { status: 'selected' as const, professionalId: professional.id, runId: randomUUID(),
    jobFingerprint: matchingJobFingerprint(job), selectedAt: new Date().toISOString() };
  await db.collection('jobs').doc(job.id).update({ matchingSelection: selected });
  await db.collection('jobs').doc(job.id).collection('matching').doc('current').set({
    runId: selected.runId, status: 'fallback', fingerprint: selected.jobFingerprint,
    selectedProfessionalId: professional.id, expiresAt: new Date(Date.now() + 600000).toISOString(),
    profileVersions: { [professional.id]: matchingProfileFingerprint(professional) },
  });
  await pricingService.execute(job.id, 'company-a', 'empresa');
}
/** Inicio idempotente explicito. */
async function start(key = randomUUID()) {
  return call(base, 'POST', { idempotencyKey: key, acknowledgeEstimate: true });
}
/** Ejecuta desde el ultimo estado visible de cada participante. */
async function command(action: CoordinatorCommand['action'], token = 'company-a', extra: Partial<CoordinatorCommand> = {}) {
  const view = (await call(base, 'GET', undefined, token)).body.datos;
  if (!view?.workflow) throw new Error('No workflow in fixture');
  return call(base + '/commands', 'POST', { workflowId: view.workflow.id, revision: view.workflow.revision,
    idempotencyKey: randomUUID(), action, ...extra }, token);
}
/** Lleva el acuerdo a una oferta recibida sin omitir consentimientos. */
async function received() {
  expect((await start()).status).toBe(200);
  expect((await command('contact')).status).toBe(200);
  expect((await command('respond', 'professional-a')).status).toBe(200);
  expect((await command('request_quote')).status).toBe(200);
  return command('submit_quote', 'professional-a', { quote: pricingQuote(1, { materials: 'included', taxes: 'included', unit: 'job', quantity: 1 }) });
}
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/jobs', jobsRoutes); app.use('/coordinator', coordinatorListRoutes);
  await new Promise<void>(resolve => { server = app.listen(0, resolve); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('port');
  url = 'http://127.0.0.1:' + address.port;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
beforeEach(async () => {
  db.clear();
  for (const uid of ['company-a', 'company-b', 'professional-a', 'professional-b', 'admin']) {
    await db.collection('users').doc(uid).set({ id: uid, activo: true, rol: uid === 'admin' ? 'admin' : uid.startsWith('professional') ? 'profesional' : 'empresa' });
  }
  await db.collection('companies').doc('company-company-a').set({ id: 'company-company-a', usuarioId: 'company-a', activo: true, totalContrataciones: 0 });
  await db.collection('companies').doc('company-company-b').set({ id: 'company-company-b', usuarioId: 'company-b', activo: true });
  await db.collection('professionals').doc('pro-electrician').set({ ...matchingProfessional({ usuarioId: 'professional-a' }) });
  await db.collection('jobs').doc('job-matching').set({ ...matchingJob({ preferredDate: 'Fecha a convenir' }) });
  await selection();
});
afterEach(() => jest.restoreAllMocks());
it('autentica, niega admin como firmante y oculta tenants o profesionales ajenos', async () => {
  expect((await call(base, 'GET', undefined, '')).status).toBe(401);
  expect((await call(base, 'GET', undefined, 'admin')).status).toBe(403);
  expect((await call(base, 'GET', undefined, 'company-b')).status).toBe(404);
  expect((await call(base, 'GET', undefined, 'professional-a')).status).toBe(404);
  await start(); await command('contact');
  expect((await call(base, 'GET', undefined, 'professional-b')).status).toBe(404);
  expect((await call(base, 'GET', undefined, 'professional-a')).status).toBe(200);
});
it('rechaza comandos desconocidos, identidad inyectada y parametros invalidos', async () => {
  expect((await call('/jobs/bad%2Fid/coordinator')).status).toBe(400);
  expect((await call(base, 'POST', { acknowledgeEstimate: false, idempotencyKey: randomUUID() })).status).toBe(400);
  expect((await call(base, 'POST', { acknowledgeEstimate: true, idempotencyKey: randomUUID(), companyId: 'company-company-b' })).status).toBe(400);
  await start();
  expect((await command('contact', 'company-a', { workflowId: undefined })).status).toBe(400);
});
it('inicio idempotente no contacta automaticamente y no expone datos privados', async () => {
  const key = randomUUID(); const a = await start(key); const b = await start(key);
  expect(a.status).toBe(200); expect(a.body.datos.workflow?.id).toBe(b.body.datos.workflow?.id);
  expect(a.body.datos.workflow).toMatchObject({ state: 'PROFESSIONAL_SELECTED', pricingInsufficient: true });
  expect([...db.documents.keys()].filter(k => k.startsWith('notifications/'))).toHaveLength(0);
  const text = JSON.stringify(a.body); for (const name of ['companyUid', 'professionalUid', 'jobFingerprint', 'startKey']) expect(text).not.toContain(name);
});
it('contacto concurrente produce una sola entrega interna sin respuesta inventada', async () => {
  const w = (await start()).body.datos.workflow!;
  const body = { workflowId: w.id, revision: w.revision, idempotencyKey: randomUUID(), action: 'contact' };
  const responses = await Promise.all([call(base + '/commands', 'POST', body), call(base + '/commands', 'POST', body)]);
  expect(responses.every(x => x.status === 200)).toBe(true);
  expect((await call()).body.datos.workflow?.state).toBe('CONTACTED');
  const notifications = [...db.documents.entries()].filter(([k]) => k.startsWith('notifications/'));
  expect(notifications).toHaveLength(1); expect(notifications[0][1]).toMatchObject({ canal: 'in_app', enviada: true, leida: false });
  expect((await command('respond')).status).toBe(409);
  expect((await call(base + '/commands', 'POST', { ...body, note: 'Otro contenido' })).status).toBe(409);
});
it('preserva CONTACT_PENDING ante fallos y permite reintentar sin duplicados', async () => {
  await start(); const deliver = jest.spyOn(coordinatorRepository, 'deliver').mockRejectedValueOnce(new Error('PRIVATE_DATABASE_DETAIL'));
  const pending = await command('contact'); expect(pending.status).toBe(200);
  expect(pending.body.datos.workflow?.state).toBe('CONTACT_PENDING');
  expect(JSON.stringify(pending.body)).not.toContain('PRIVATE');
  deliver.mockRestore(); expect(await coordinatorRepository.deliver('job-matching')).toBe(true);
  expect(await coordinatorRepository.deliver('job-matching')).toBe(false);
});
it('revalida seleccion, vigencia y presupuesto antes del handoff', async () => {
  const job = db.documents.get('jobs/job-matching') as unknown as Trabajo;
  const estimateId = (await pricingService.get(job.id, 'company-a', 'empresa')).result!.id;
  await expect(coordinatorRepository.start(job.id, 'company-a', { acknowledgeEstimate: true, idempotencyKey: randomUUID() },
    estimateId, { ...job.matchingSelection!, professionalId: 'another' })).rejects.toMatchObject({ codigoEstado: 409 });
  await db.collection('jobs').doc(job.id).collection('matching').doc('current').update({ expiresAt: null });
  expect((await start()).status).toBe(409);
});
it('oferta y contraofertas se reservan para ambas partes y solo la contraparte acepta', async () => {
  expect((await received()).status).toBe(200);
  expect((await command('accept_quote')).status).toBe(409);
  await command('review_quote');
  const quote = pricingQuote(2, { materials: 'included', taxes: 'included' });
  expect((await command('counter_offer', 'company-a', { quote })).status).toBe(200);
  expect((await command('accept_quote')).status).toBe(409);
  expect((await command('counter_offer', 'professional-a', { quote: { ...quote, id: pricingQuote(3).id } })).status).toBe(200);
  expect((await command('counter_offer', 'company-a', { quote })).status).toBe(409);
  expect([...db.documents.keys()].filter(k => k.includes('/coordinator_offers/'))).toHaveLength(3);
});
it('ejecuta hasta COMPLETED una sola vez, con agenda bilateral, propuestas y evento de reviews', async () => {
  await received(); await command('review_quote'); await command('accept_quote');
  const startsAt = new Date(Date.now() + 60000).toISOString();
  expect((await command('propose_schedule', 'company-a', { schedule: { startsAt, endsAt: new Date(Date.now() + 3600000).toISOString() } })).status).toBe(200);
  expect((await command('confirm_schedule')).status).toBe(409);
  expect((await command('confirm_schedule', 'professional-a')).status).toBe(200);
  expect(db.documents.get('jobs/job-matching')).toMatchObject({ estado: 'en_revision', profesionalAsignadoId: 'pro-electrician' });
  expect((await command('start_work', 'professional-a')).status).toBe(409);
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse(startsAt) + 1000);
  expect((await command('start_work', 'professional-a')).status).toBe(200);
  expect((await command('complete')).status).toBe(409);
  expect((await command('request_completion', 'professional-a')).status).toBe(200);
  const w = (await call()).body.datos.workflow!;
  const body = { workflowId: w.id, revision: w.revision, idempotencyKey: randomUUID(), action: 'complete' };
  expect((await call(base + '/commands', 'POST', body)).status).toBe(200);
  expect((await call(base + '/commands', 'POST', body)).status).toBe(200);
  expect(db.documents.get('jobs/job-matching')).toMatchObject({ estado: 'completado', status: 'completado' });
  expect(db.documents.get('professionals/pro-electrician')?.totalTrabajos).toBe(51);
  expect(db.documents.get('companies/company-company-a')?.totalContrataciones).toBe(1);
  expect(db.documents.get('coordinator_outbox/' + w.id + '_completed')).toMatchObject({ status: 'awaiting_reviews' });
});
it('revoca datos nuevos del Job al profesional despues de cancelar', async () => {
  await start(); await command('contact'); await command('cancel', 'professional-a', { note: 'No puedo realizarlo' });
  await db.collection('jobs').doc('job-matching').update({ estado: 'borrador', titulo: 'Secreto posterior', descripcion: 'Datos nuevos privados' });
  const view = await call(base, 'GET', undefined, 'professional-a');
  expect(view.status).toBe(200); expect(JSON.stringify(view.body)).not.toContain('Secreto posterior');
  expect((await call()).body.datos.job.title).toBe('Secreto posterior');
});
it('inicios durables y workflowId bloquean reintentos de una coordinacion anterior', async () => {
  const key = randomUUID(); const first = (await start(key)).body.datos.workflow!;
  await command('contact'); await command('cancel', 'professional-a', { note: 'No puedo realizarlo' });
  await selection(); const second = (await start()).body.datos.workflow!;
  expect(second.id).not.toBe(first.id);
  expect((await command('contact', 'company-a', { workflowId: first.id })).status).toBe(409);
  await command('contact'); await command('cancel', 'professional-a', { note: 'No puedo realizarlo' });
  expect((await start(key)).body.datos.workflow?.id).toBe(second.id);
});
it('bandejas propias revalidan identidad y no filtran cambios de titularidad', async () => {
  await start(); await command('contact');
  const a = await call('/coordinator'); expect(a.status).toBe(200);
  expect(JSON.stringify(a.body)).toContain('job-matching');
  expect(JSON.stringify((await call('/coordinator', 'GET', undefined, 'company-b')).body)).not.toContain('job-matching');
  await db.collection('companies').doc('company-company-a').update({ usuarioId: 'other-owner' });
  expect(JSON.stringify((await call('/coordinator')).body)).not.toContain('job-matching');
});
it('la revision limite no impide primera agenda ni cierre de un trabajo iniciado', async () => {
  await received(); await command('review_quote'); await command('accept_quote');
  await db.collection('jobs').doc('job-matching').collection('coordinator').doc('current').update({ revision: 200 });
  expect((await command('propose_schedule', 'company-a', { schedule: {
    startsAt: new Date(Date.now() + 60000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString(),
  } })).status).toBe(200);
});
it('un fallo interno devuelve mensaje seguro y no expone credenciales', async () => {
  jest.spyOn(coordinatorRepository, 'read').mockRejectedValue(new Error('PRIVATE_KEY=do-not-expose'));
  const response = await call(); expect(response.status).toBe(503); expect(JSON.stringify(response.body)).not.toContain('PRIVATE_KEY');
});
it('el adaptador respeta FieldValue.delete y cursor por ID', async () => {
  await received(); await command('review_quote'); await command('accept_quote');
  await command('propose_schedule', 'company-a', { schedule: { startsAt: new Date(Date.now() + 60000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString() } });
  await command('confirm_schedule', 'professional-a'); await command('cancel', 'professional-a', { note: 'No puedo asistir' });
  expect(db.documents.get('jobs/job-matching')).not.toHaveProperty('profesionalAsignadoId');
  const rows = await db.collection('users').orderBy('__name__').startAfter('company-a').limit(1).get();
  expect(rows.docs[0].id).toBe('company-b');
});
