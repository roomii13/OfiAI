/** @archivo production-readiness.cjs @descripcion Inspeccion remota de solo lectura; no crea usuarios, pagos ni despliegues. */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { cert, initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const dotenv = require('dotenv');
const root = path.resolve(__dirname, '../../..');

/** Normaliza diferencias de fin de linea sin ocultar diferencias de reglas. */
function digest(value) { return createHash('sha256').update(value.replace(/\r\n/g, '\n').trim()).digest('hex'); }
/** Solo consulta; ni los tokens ni las respuestas con datos privados se imprimen. */
async function main() {
  const env = dotenv.parse(fs.readFileSync(path.join(root, 'backend/.env'), 'utf8'));
  if (env.FIREBASE_PROJECT_ID !== 'ofiai-2f357') throw new Error('Proyecto inesperado: se cancelo la comprobacion.');
  const credential = cert({ projectId: env.FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') });
  const app = initializeApp({ credential, projectId: env.FIREBASE_PROJECT_ID }, 'readiness-read-only');
  const db = getFirestore(app, env.FIREBASE_DATABASE_ID || '(default)');
  const report = { checkedAt: new Date().toISOString(), writes: 0, database: env.FIREBASE_DATABASE_ID || '(default)' };
  try {
    const token = (await credential.getAccessToken()).access_token;
    /** GET protegido con timeout y salida reducida a evidencia no sensible. */
    async function get(url, bearer = token) {
      const response = await fetch(url, { headers: { Authorization: 'Bearer ' + bearer }, signal: AbortSignal.timeout(25000) });
      return { status: response.status, data: await response.json().catch(() => ({})) };
    }
    const prefix = 'https://firebaserules.googleapis.com/v1/projects/' + env.FIREBASE_PROJECT_ID;
    const releases = await get(prefix + '/releases?pageSize=100');
    report.rules = { status: releases.status, releases: [] };
    for (const release of releases.data.releases || []) {
      if (!release.name.includes('cloud.firestore') && !release.name.includes('firebase.storage')) continue;
      const result = await get('https://firebaserules.googleapis.com/v1/' + release.rulesetName);
      if (process.argv.includes('--show-rules')) console.log(JSON.stringify({ release: release.name, source: result.data.source }));
      const localPath = release.name.includes('cloud.firestore') ? 'firestore.rules' : 'storage.rules';
      const local = fs.readFileSync(path.join(root, 'shared', localPath), 'utf8');
      report.rules.releases.push({ name: release.name, updatedAt: release.updateTime, status: result.status,
        matchesLocal: result.data.source?.files?.some(file => digest(file.content || '') === digest(local)) ?? false });
    }
    const indexes = await get('https://firestore.googleapis.com/v1/projects/' + env.FIREBASE_PROJECT_ID
      + '/databases/' + encodeURIComponent(report.database) + '/collectionGroups/-/indexes');
    /** Compara estructura de indices, ignorando el campo __name__ implicito. */
    function indexKey(collection, index) {
      return JSON.stringify({ collection, scope: index.queryScope,
        fields: index.fields.filter(field => field.fieldPath !== '__name__').map(field => ({
          fieldPath: field.fieldPath, ...(field.order ? { order: field.order } : {}),
          ...(field.arrayConfig ? { arrayConfig: field.arrayConfig } : {}),
        })) });
    }
    const remote = (indexes.data.indexes || []).map(index => ({ ...index,
      key: indexKey(index.name.split('/collectionGroups/')[1].split('/')[0], index) }));
    const required = JSON.parse(fs.readFileSync(path.join(root, 'shared/firestore.indexes.json'), 'utf8')).indexes;
    report.indexes = { status: indexes.status, error: indexes.data.error?.message, required: required.length, remote: remote.length,
      readyRequired: required.filter(index => remote.some(item => item.key === indexKey(index.collectionGroup, index) && item.state === 'READY')).length,
      nonReady: remote.filter(item => item.state !== 'READY').map(item => item.state) };
    const professionalSubscriptions = await db.collection('subscriptions').where('rolUsuario', '==', 'profesional')
      .select('renovacionAutomatica', 'mercadoPagoPreapprovalId', 'plan', 'estado').limit(501).get();
    report.professionalSubscriptions = { scanned: professionalSubscriptions.size, truncated: professionalSubscriptions.size === 501,
      recurringContracts: professionalSubscriptions.docs.filter(doc => doc.data().renovacionAutomatica
        && doc.data().mercadoPagoPreapprovalId && doc.data().plan !== 'gratuito').length };
    report.testCredentialsPresent = Boolean(env.MERCADOPAGO_TEST_ACCESS_TOKEN);
    if (env.MERCADOPAGO_ACCESS_TOKEN) {
      const merchant = await get('https://api.mercadopago.com/users/me', env.MERCADOPAGO_ACCESS_TOKEN);
      report.mercadoPago = { status: merchant.status, site: merchant.data.site_id, providerWebhookDeliveryVerified: false };
    }
    console.log(JSON.stringify(report, null, 2));
  } finally { await db.terminate(); await deleteApp(app); }
}
main().catch(error => { console.error(JSON.stringify({ failed: true, code: error.code ?? error.name })); process.exitCode = 1; });
