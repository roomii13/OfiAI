/** @archivo billing.worker.ts @descripcion Conciliacion limitada y paginada; nunca inicia debitos ni usa IA. */
import { randomUUID } from 'node:crypto';
import { FieldPath } from 'firebase-admin/firestore';
import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { mercadoPagoDisponible } from '../integrations/mercadopago';
import { subscriptionService } from '../services/subscription.service';
import { logger } from '../config/logger';

/** Revisa cinco contratos y tres facturas por contrato; el cursor evita repetir solo los primeros usuarios. */
export async function billingReconciliationWorker(): Promise<number> {
  if (!mercadoPagoDisponible()) return 0;
  const token = randomUUID(); const ref = firestore.collection(COLECCIONES.BILLING_TASKS).doc('reconciliation');
  const claimed = await firestore.runTransaction(async tx => {
    const previous = (await tx.get(ref)).data();
    if (typeof previous?.leaseUntil === 'number' && previous.leaseUntil > Date.now()) return null;
    tx.set(ref, { cursor: previous?.cursor ?? '', token, leaseUntil: Date.now() + 15 * 60000 });
    return { cursor: String(previous?.cursor ?? '') };
  });
  if (!claimed) return 0;
  let cursor = claimed.cursor; let processed = 0;
  try {
    let query = firestore.collection(COLECCIONES.SUSCRIPCIONES).where('renovacionAutomatica', '==', true).orderBy(FieldPath.documentId());
    if (cursor) query = query.startAfter(cursor);
    const page = await query.limit(5).get();
    for (const doc of page.docs) {
      const sub = doc.data();
      try {
        await subscriptionService.renovarSuscripcion(doc.id, String(sub.usuarioId), 'admin', 3); processed++;
      } catch {
        logger.warn('Contrato pendiente de conciliacion; se reintentara en la siguiente vuelta.', { subscriptionId: doc.id });
      }
      cursor = doc.id;
    }
    if (page.size < 5) cursor = '';
    return processed;
  } finally {
    await firestore.runTransaction(async tx => {
      const state = (await tx.get(ref)).data();
      if (state?.token === token) tx.set(ref, { cursor, token: null, leaseUntil: 0, updatedAt: new Date() });
    });
  }
}
