/** @archivo coordinator.rules.test.mjs @descripcion Reglas locales con identidades sinteticas; nunca usa credenciales ni servicios productivos. */
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const directory = process.env.OFIAI_RULES_TOOLS_DIR;
if (!directory) throw new Error('Configura OFIAI_RULES_TOOLS_DIR con las herramientas de test aisladas.');
const require = createRequire(directory + '/package.json');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, setLogLevel } = require('firebase/firestore');
setLogLevel('silent');
const host = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8085';
assert.match(host, /^127\.0\.0\.1:\d+$/);
const rules = await readFile(fileURLToPath(new URL('./firestore.rules', import.meta.url)), 'utf8');
const env = await initializeTestEnvironment({ projectId: 'demo-ofiai-coordinator', firestore: {
  host: '127.0.0.1', port: Number(host.split(':')[1]), rules,
} });
let checks = 0;
try {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const [path, data] of Object.entries({
      'users/company-a': { activo: true, rol: 'empresa' }, 'users/company-b': { activo: true, rol: 'empresa' },
      'users/pro-a': { activo: true, rol: 'profesional' }, 'users/pro-b': { activo: true, rol: 'profesional' },
      'users/admin': { activo: true, rol: 'admin' }, 'users/suspended': { activo: false, rol: 'admin' },
      'companies/company-a': { usuarioId: 'company-a' }, 'companies/company-b': { usuarioId: 'company-b' },
      'professionals/pro-a': { usuarioId: 'pro-a' }, 'professionals/pro-b': { usuarioId: 'pro-b' },
      'jobs/job-a': { empresaId: 'company-a', estado: 'borrador' },
      'proposals/quote-a': { empresaId: 'company-a', profesionalId: 'pro-a', precioOfertado: 100 },
      'notifications/n-a': { usuarioId: 'pro-a', leida: false },
    })) await setDoc(doc(db, path), data);
  });
  const clients = {
    anonymous: env.unauthenticatedContext().firestore(),
    companyA: env.authenticatedContext('company-a', { rol: 'empresa' }).firestore(),
    companyB: env.authenticatedContext('company-b', { rol: 'empresa' }).firestore(),
    professionalA: env.authenticatedContext('pro-a', { rol: 'profesional' }).firestore(),
    professionalB: env.authenticatedContext('pro-b', { rol: 'profesional' }).firestore(),
    admin: env.authenticatedContext('admin', { rol: 'admin' }).firestore(),
    suspended: env.authenticatedContext('suspended', { rol: 'admin' }).firestore(),
    forgedAdmin: env.authenticatedContext('company-b', { rol: 'admin' }).firestore(),
  };
  for (const [name, db] of Object.entries(clients)) {
    const own = ['companyA', 'professionalA', 'admin'].includes(name);
    await (own ? assertSucceeds : assertFails)(getDoc(doc(db, 'proposals/quote-a'))); checks++;
    if (name !== 'admin') { await assertFails(setDoc(doc(db, 'proposals/quote-a'), { precioOfertado: 1 })); checks++; }
    for (const path of ['jobs/job-a/coordinator/current', 'jobs/job-a/coordinator_history/h',
      'jobs/job-a/coordinator_commands/c', 'jobs/job-a/coordinator_offers/o',
      'coordination_workflows/job-a', 'coordinator_outbox/completed',
      'billing_accounts/company-a', 'billing_accounts/company-a/billing_usage/2026-09',
      'billing_accounts/company-a/quota_operations/proposal-a',
      'billing_payments/mp_1', 'billing_revenue/2026-09_ARS', 'billing_tasks/reconciliation',
      'sales_leads/company-a', 'sales_leads/company-a/interactions/one',
      'marketing_campaigns/campaign-a', 'support_sessions/session-a', 'support_tickets/ticket-a',
      'agent_runs/run-a', 'agent_events/event-a', 'ai_knowledge/document-a',
      'agent_audit/audit-a', 'ai_budgets/budget-a', 'ai_observations/observation-a']) {
      await assertFails(getDoc(doc(db, path))); checks++;
      await assertFails(setDoc(doc(db, path), { state: 'COMPLETED' })); checks++;
    }
  }
  await assertSucceeds(getDoc(doc(clients.companyA, 'jobs/job-a'))); checks++;
  await assertFails(getDoc(doc(clients.companyB, 'jobs/job-a'))); checks++;
  await assertFails(getDoc(doc(clients.professionalA, 'jobs/job-a'))); checks++;
  await assertSucceeds(getDoc(doc(clients.professionalA, 'notifications/n-a'))); checks++;
  await assertFails(getDoc(doc(clients.professionalB, 'notifications/n-a'))); checks++;
  for (const db of Object.values(clients)) {
    await assertFails(setDoc(doc(db, 'subscriptions/sub-test'), { usuarioId: 'company-a', estado: 'activa' })); checks++;
    await assertFails(setDoc(doc(db, 'subscription_history/event-test'), { usuarioId: 'company-a' })); checks++;
  }
  await assertFails(getDoc(doc(clients.suspended, 'jobs/job-a'))); checks++;
  await assertFails(getDoc(doc(clients.forgedAdmin, 'jobs/job-a'))); checks++;
  await assertFails(setDoc(doc(clients.companyA, 'users/company-a'), { activo: true, rol: 'admin' })); checks++;
  await assertFails(setDoc(doc(clients.anonymous, 'users/new-account'), { activo: true, rol: 'admin' })); checks++;
  console.log(JSON.stringify({ checks, rules: 'passed', emulator: host, productionWrites: 0 }));
} finally { await env.cleanup(); }
