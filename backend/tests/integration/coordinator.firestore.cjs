/** @archivo coordinator.firestore.cjs @descripcion Flujo completo con SDK Firestore real, EXCLUSIVAMENTE emulador localhost. */
const { createRequire } = require('node:module');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const host = process.argv[2];
if (!/^127\.0\.0\.1:\d+$/.test(host ?? '')) throw new Error('Requiere host explicito de emulador local');
process.env.NODE_ENV = 'test'; process.env.FIRESTORE_EMULATOR_HOST = host;
process.env.FIREBASE_PROJECT_ID = 'demo-ofiai-coordinator'; process.env.FIREBASE_DATABASE_ID = '(default)';
process.env.FIREBASE_CLIENT_EMAIL = ''; process.env.FIREBASE_PRIVATE_KEY = ''; process.env.SCHEDULER_ENABLED = 'false';
const r = createRequire(require('node:path').resolve(__dirname, '../../package.json'));
const { getFirestore, getFirebaseApp } = r('./dist/config/firebase');
const { CoordinatorRepository } = r('./dist/repositories/coordinator.repository');
const { coordinatorService } = r('./dist/services/coordinator.service');
const { matchingJobFingerprint, matchingProfileFingerprint } = r('./dist/domain/matching/matching');
const { calculatePricing } = r('./dist/ai/tools/pricing.tool');
const db = getFirestore(); const repo = new CoordinatorRepository(db);
const id = 'qa-' + randomUUID(), companyId = id + '-company', professionalId = id + '-pro';
const companyUid = id + '-company-user', professionalUid = id + '-pro-user';
/** Prepara documentos aislados en el emulador; no crea usuarios ni toca el proyecto real. */
async function fixture(jobId = id) {
  const now = new Date(), runId = randomUUID(), estimateId = randomUUID();
  const job = { id: jobId, empresaId: companyId, titulo: 'Prueba local de coordinacion', descripcion: 'Revision completa de tablero electrico',
    categoria: 'Electricidad', habilidadesRequeridas: ['tablero'], tipoTrabajo: 'presencial', ciudad: 'Santa Rosa',
    location: { country: 'Argentina', city: 'Santa Rosa', region: 'La Pampa' }, moneda: 'ARS',
    estado: 'publicado', status: 'publicado', source: 'ai_intake', propuestasRecibidas: 0, fechaCreacion: now, fechaActualizacion: now };
  const pro = { id: professionalId, usuarioId: professionalUid, nombre: 'Prueba', apellido: 'Local',
    categorias: ['Electricidad'], especialidades: ['tablero'], aniosExperiencia: 8, moneda: 'ARS', disponible: true,
    status: 'active', pais: 'AR', ciudad: 'Santa Rosa', totalResenas: 0, calificacionPromedio: 0, totalTrabajos: 0, verificado: false,
    fechaCreacion: now, fechaActualizacion: now };
  await db.collection('companies').doc(companyId).set({ id: companyId, usuarioId: companyUid, activo: true, totalContrataciones: 0 });
  await db.collection('professionals').doc(professionalId).set(pro);
  const fingerprint = matchingJobFingerprint(job);
  job.matchingSelection = { status: 'selected', professionalId, runId, jobFingerprint: fingerprint, selectedAt: now.toISOString() };
  await db.collection('jobs').doc(jobId).set(job);
  await db.collection('jobs').doc(jobId).collection('matching').doc('current').set({
    runId, status: 'fallback', fingerprint, selectedProfessionalId: professionalId, expiresAt: new Date(Date.now() + 600000).toISOString(),
    profileVersions: { [professionalId]: matchingProfileFingerprint(pro) },
  });
  const result = calculatePricing(job, null, [], [], estimateId);
  await db.collection('jobs').doc(jobId).collection('pricing').doc('current').set({ id: estimateId, status: 'completed', result });
  await db.collection('jobs').doc(jobId).collection('pricing_estimates').doc(estimateId).set({ revision: 0, jobFingerprint: fingerprint });
  await repo.start(jobId, companyUid, { idempotencyKey: randomUUID(), acknowledgeEstimate: true }, estimateId, job.matchingSelection);
}
/** Un comando siempre usa la revision actual, como las aplicaciones. */
async function command(action, role, extra = {}, jobId = id) {
  const uid = role === 'empresa' ? companyUid : professionalUid;
  const { workflow } = await repo.read(jobId, uid, role);
  const body = { workflowId: workflow.id, revision: workflow.revision, action, idempotencyKey: randomUUID(), ...extra };
  await repo.command(jobId, uid, role, body); return body;
}
/** Comprueba persistencia, permisos, carreras, terminales, counters y snapshot historico. */
async function main() {
  await fixture();
  await assert.rejects(repo.read(id, 'intruso', 'empresa'), error => error.codigoEstado === 404);
  const contact = await command('contact', 'empresa');
  await repo.command(id, companyUid, 'empresa', contact);
  await repo.deliver(id); assert.equal(await repo.deliver(id), false);
  await command('respond', 'profesional'); await command('request_quote', 'empresa');
  const quote = { id: randomUUID(), label: 'Oferta de prueba', amount: 120000, currency: 'ARS', scope: 'Revision completa del tablero electrico',
    unit: 'job', quantity: 1, materials: 'included', taxes: 'included', validUntil: new Date(Date.now()+86400000).toISOString().slice(0,10) };
  await command('submit_quote', 'profesional', { quote });
  await command('review_quote', 'empresa');
  await command('counter_offer', 'empresa', { quote: { ...quote, id: randomUUID(), amount: 110000 } });
  await command('accept_quote', 'profesional');
  const startsAt = new Date(Date.now() + 2500).toISOString(), endsAt = new Date(Date.now() + 3600000).toISOString();
  await command('propose_schedule', 'empresa', { schedule: { startsAt, endsAt } });
  await command('confirm_schedule', 'profesional');
  const confirmed = (await db.collection('jobs').doc(id).get()).data();
  assert.equal(confirmed.profesionalAsignadoId, professionalId); assert.equal(confirmed.estado, 'en_revision');
  await assert.rejects(command('start_work', 'empresa'), error => error.codigoEstado === 409);
  await new Promise(resolve => setTimeout(resolve, Math.max(0, Date.parse(startsAt) - Date.now() + 50)));
  await command('start_work', 'profesional'); await command('request_completion', 'profesional');
  const completion = await command('complete', 'empresa');
  await repo.command(id, companyUid, 'empresa', completion);
  const job = (await db.collection('jobs').doc(id).get()).data();
  assert.equal(job.estado, 'completado'); assert.equal(job.status, 'completado');
  assert.equal((await db.collection('professionals').doc(professionalId).get()).data().totalTrabajos, 1);
  assert.equal((await db.collection('companies').doc(companyId).get()).data().totalContrataciones, 1);
  const { workflow } = await repo.read(id, companyUid, 'empresa');
  assert((await repo.history(id, workflow.id)).length >= 14);
  assert.equal((await db.collection('coordinator_outbox').doc(workflow.id + '_completed').get()).data().status, 'awaiting_reviews');
  assert.equal((await db.collection('jobs').doc(id).collection('coordinator_offers').get()).size, 2);
  assert((await repo.list(companyUid, 'empresa')).items.some(item => item.jobId === id));
  const otherId = id + '-cancelled';
  await fixture(otherId); await command('contact', 'empresa', {}, otherId); await repo.deliver(otherId);
  await command('cancel', 'profesional', { note: 'No puedo realizar el trabajo.' }, otherId);
  await db.collection('jobs').doc(otherId).update({ estado: 'borrador', titulo: 'Informacion privada posterior', descripcion: 'No debe verla el anterior profesional' });
  const view = await coordinatorService.get(otherId, professionalUid, 'profesional');
  assert.notEqual(view.job.title, 'Informacion privada posterior');
  assert.equal('companyUid' in view.workflow, false);
  console.log(JSON.stringify({ emulator: host, project: process.env.FIREBASE_PROJECT_ID, completedWorkflow: true,
    realFirestoreTransactions: true, authorization: true, idempotency: true, immutableOffers: 2,
    countersExactlyOnce: true, cancelledSnapshotPrivacy: true, reputationOutbox: 'awaiting_reviews',
    productionWrites: 0 }));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(async () => { await db.terminate(); await getFirebaseApp().delete(); });
