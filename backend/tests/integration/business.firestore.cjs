/** @archivo business.firestore.cjs @descripcion Flujos comerciales reales contra Firestore Emulator; sin credenciales ni proveedores externos. */
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const host = process.argv[2];
assert.match(host ?? '', /^127\.0\.0\.1:\d+$/);
Object.assign(process.env, { NODE_ENV: 'test', FIRESTORE_EMULATOR_HOST: host, FIREBASE_PROJECT_ID: 'demo-ofiai-business',
  FIREBASE_DATABASE_ID: '(default)', FIREBASE_CLIENT_EMAIL: '', FIREBASE_PRIVATE_KEY: '',
  GROQ_API_KEY: '', GEMINI_API_KEY: '', DEEPSEEK_API_KEY: '', AI_BUSINESS_LLM_ENABLED: 'false',
  AI_LEGACY_FALLBACK_ENABLED: 'false', SCHEDULER_ENABLED: 'false' });
const { getFirestore, getFirebaseApp } = require('../../dist/config/firebase');
const { deleteApp } = require('firebase-admin/app');
const { salesService } = require('../../dist/services/sales.service');
const { marketingService } = require('../../dist/services/marketing.service');
const { supportService } = require('../../dist/services/support.service');
const { knowledgeService } = require('../../dist/services/knowledge.service');
const { orchestratorService } = require('../../dist/services/orchestrator.service');
const { governanceService } = require('../../dist/services/governance.service');
const { operationsService } = require('../../dist/services/operations.service');
const { intelligenceService } = require('../../dist/services/intelligence.service');
const { agentDataRepository } = require('../../dist/repositories/agent-data.repository');
const db = getFirestore();
let checks = 0;
/** Cuenta comprobaciones explicitas en lugar de presentar cada escritura como un test. */
function equal(actual, expected) { assert.deepEqual(actual, expected); checks++; }
/** Valida denegaciones con el codigo de dominio, no solo cualquier excepcion. */
async function rejects(work, status) { await assert.rejects(work, error => error.codigoEstado === status); checks++; }
/** Recorre servicios/repositorios reales con usuarios y documentos sinteticos. */
async function main() {
  const key = randomUUID();
  const company = { uid: 'company-' + key, rol: 'empresa' }, other = { uid: 'other-' + key, rol: 'empresa' };
  const professional = { uid: 'professional-' + key, rol: 'profesional' }, admin = { uid: 'admin-' + key, rol: 'admin' };
  const entity = 'entity-' + key, jobId = 'job-' + key;
  for (const actor of [company, other, professional, admin])
    await db.collection('users').doc(actor.uid).set({ id: actor.uid, rol: actor.rol, activo: true, nombre: 'QA' });
  await db.collection('companies').doc(entity).set({ id: entity, usuarioId: company.uid, nombreEmpresa: 'Empresa QA', ciudad: 'Santa Rosa' });
  await db.collection('companies').doc('other-' + entity).set({ usuarioId: other.uid });
  await db.collection('professionals').doc(professional.uid).set({ usuarioId: professional.uid, nombre: 'QA', apellido: 'Profesional',
    categorias: ['Electricidad'], ciudad: 'Santa Rosa', aniosExperiencia: 3, disponible: true, verificado: false, activo: true, status: 'active' });
  await db.collection('jobs').doc(jobId).set({ id: jobId, empresaId: entity, titulo: 'Tablero electrico',
    descripcion: 'Revisar el tablero del edificio.', categoria: 'Electricidad', ciudad: 'Santa Rosa',
    estado: 'publicado', moneda: 'ARS', habilidadesRequeridas: [], tipoTrabajo: 'presencial',
    fechaCreacion: new Date(), fechaActualizacion: new Date(), propuestasRecibidas: 0, direccionPrivada: 'NO EXPONER' });

  let lead = await salesService.optIn(company, { need: 'Quiero publicar trabajos', expectedMonthlyVolume: 4, consent: false });
  equal(lead.userId, company.uid); equal(lead.stage, 'LEAD');
  await rejects(salesService.get(other, company.uid), 404);
  await rejects(salesService.command(admin, company.uid, { action: 'contact', version: lead.version }), 409);
  await rejects(salesService.command(admin, company.uid, { action: 'sync', version: lead.version }), 409);
  lead = await salesService.optIn(company, { need: 'Quiero contratar profesionales', expectedMonthlyVolume: 4, consent: true });
  lead = await salesService.command(admin, company.uid, { action: 'qualify', version: lead.version });
  equal(lead.stage, 'QUALIFIED');
  const oldVersion = lead.version;
  lead = await salesService.command(admin, company.uid, { action: 'contact', version: lead.version });
  equal(lead.stage, 'CONTACTED');
  await rejects(salesService.command(admin, company.uid, { action: 'interested', version: oldVersion }), 409);
  equal((await db.collection('notifications').where('usuarioId','==',company.uid).get()).size, 1);

  const draft = await marketingService.create(admin, { name: 'Campana QA', objective: 'activacion', audience: 'empresa',
    channel: 'email', stages: ['QUALIFIED'], currency: 'ARS', hypothesis: 'Hipotesis de prueba local' });
  equal(draft.status, 'draft');
  await rejects(marketingService.list(company), 403);
  await rejects(marketingService.command(admin, draft.id, { action: 'dispatch', version: draft.version }), 409);
  const approved = await marketingService.command(admin, draft.id, { action: 'approve', version: draft.version });
  equal(approved.campaign.status, 'approved');

  const knowledge = await knowledgeService.create(company, { scope: 'private', title: 'Horario preferido',
    text: 'Preferimos reparaciones por la manana.', kind: 'preference', consent: true, retentionDays: 30 });
  equal((await knowledgeService.search(company, { scope: 'private', query: 'reparaciones' })).hits.length, 1);
  equal((await knowledgeService.search(other, { scope: 'private', query: 'reparaciones' })).hits.length, 0);
  await rejects(knowledgeService.command(other, knowledge.id, { action: 'delete', version: 1 }), 404);
  await rejects(knowledgeService.create(company, { scope: 'platform', title: 'Fraude', text: 'Documento no autorizado',
    kind: 'policy', consent: true, retentionDays: 1 }), 403);
  await rejects(knowledgeService.create(company, { scope: 'job', jobId: 'missing', title: 'Nota', text: 'Privada',
    kind: 'preference', consent: true, retentionDays: 1 }), 404);

  await rejects(supportService.start(other, { resource: { tool: 'getJob', id: jobId } }), 404);
  let session = await supportService.start(company, { resource: { tool: 'getJob', id: jobId } });
  await rejects(supportService.get(other, session.id), 404);
  const message = { message: 'Necesito una persona por un reclamo', version: session.version, requestId: randomUUID() };
  session = await supportService.message(company, session.id, message);
  equal(session.status, 'escalated'); equal(session.messages.length, 2);
  equal(JSON.stringify(session).includes('NO EXPONER'), false);
  equal((await supportService.message(company, session.id, message)).messages.length, 2);
  await rejects(supportService.tickets(company), 403);
  const ticket = await supportService.ticket(admin, session.id);
  equal(ticket.ticket.ownerId, company.uid);
  const resolved = await supportService.command(admin, session.id, { action: 'resolve', version: ticket.ticket.version });
  equal(resolved.session.status, 'resolved');

  const snapshot = await intelligenceService.snapshot(company);
  equal(snapshot.categories.some(category => category.name === 'Electricidad'), true);
  equal((await intelligenceService.snapshot(other)).categories.length, 0);
  await rejects(orchestratorService.execute(other, { event: 'job.created', resourceId: jobId, requestId: randomUUID() }), 404);
  await rejects(orchestratorService.execute(professional, { event: 'sales.review', resourceId: company.uid, requestId: randomUUID() }), 403);
  const runInput = { event: 'business.review', requestId: randomUUID() };
  const run = await orchestratorService.execute(company, runInput);
  equal(run.status, 'completed'); equal(run.steps[0].tool, 'getIntelligence');
  equal((await orchestratorService.execute(company, runInput)).id, run.id);
  await rejects(orchestratorService.execute(company, { ...runInput, event: 'job.review', resourceId: jobId }), 409);
  await rejects(orchestratorService.get(other, run.id), 404);
  const overview = await governanceService.overview(admin);
  equal(overview.metrics.hallucinationRate, null);
  await rejects(governanceService.overview(company), 403);
  await rejects(operationsService.list(company, { resource: 'users' }), 403);
  const center = await operationsService.center(admin);
  equal(center.ai.automationRate, null);
  await operationsService.command(admin, { targetId: professional.uid, action: 'suspend_user', reason: 'Prueba local autorizada' });
  await rejects(agentDataRepository.getProfessional(company, professional.uid), 404);
  await rejects(orchestratorService.execute(professional, { event: 'business.review', requestId: randomUUID() }), 403);
  console.log(JSON.stringify({ checks, project: process.env.FIREBASE_PROJECT_ID, emulator: host,
    businessFlows: 'passed', productionWrites: 0, externalNotifications: 0, providerCalls: 0 }));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await deleteApp(getFirebaseApp()); });
