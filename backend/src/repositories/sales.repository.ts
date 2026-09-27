/** @archivo sales.repository.ts @descripcion CRM y notificaciones internas atomicas e idempotentes. */
import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { ApiError } from '../middleware/error.middleware';
import type { SalesLead, SalesInteraction, SalesDetail } from '../models/sales.model';
import { FieldPath } from 'firebase-admin/firestore';

/** Encapsula documentos privados del CRM; ningun agente recibe Firestore. */
export class SalesRepository {
  /** Lee un lead mediante su UID sin conservar email ni telefono. */
  async get(id: string): Promise<SalesLead | null> {
    const doc = await firestore.collection(COLECCIONES.SALES_LEADS).doc(id).get();
    return doc.exists ? doc.data() as SalesLead : null;
  }
  /** Lista acotada con cursor estable; las metricas corresponden a la pagina. */
  async list(cursor?: string): Promise<{ leads: SalesLead[]; nextCursor: string | null }> {
    let query = firestore.collection(COLECCIONES.SALES_LEADS).orderBy(FieldPath.documentId()).limit(51);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get(); const docs = page.docs.slice(0, 50);
    return { leads: docs.map(doc => doc.data() as SalesLead), nextCursor: page.size > 50 ? docs.at(-1)!.id : null };
  }
  /** Recupera solo las ultimas interacciones, no el historial completo. */
  async detail(lead: SalesLead): Promise<SalesDetail> {
    const docs = await firestore.collection(COLECCIONES.SALES_LEADS).doc(lead.id).collection('interactions')
      .orderBy('createdAt', 'desc').limit(30).get();
    return { lead, interactions: docs.docs.map(doc => doc.data() as SalesInteraction).reverse() };
  }
  /** Usa control optimista y crea el mensaje interno en la misma transaccion. */
  async save(lead: SalesLead, expectedVersion: number, interaction: Omit<SalesInteraction, 'id' | 'leadId'>,
    notify = false): Promise<SalesLead> {
    const ref = firestore.collection(COLECCIONES.SALES_LEADS).doc(lead.id);
    const event = ref.collection('interactions').doc();
    return firestore.runTransaction(async tx => {
      const snapshot = await tx.get(ref); const current = snapshot.data() as SalesLead | undefined;
      const owner=notify?await tx.get(firestore.collection(COLECCIONES.USUARIOS).doc(lead.userId)):null;
      if ((current?.version ?? 0) !== expectedVersion) throw new ApiError('El lead cambio. Actualiza antes de continuar.', 409);
      if (notify && (!lead.consent || !current?.consent)) throw new ApiError('El usuario no autorizo el contacto comercial.', 409);
      if(notify&&!owner?.data()?.activo) throw new ApiError('La cuenta ya no admite contacto.',409);
      const saved = { ...lead, version: expectedVersion + 1, updatedAt: new Date().toISOString() };
      tx.set(ref, saved);
      tx.create(event, { ...interaction, id: event.id, leadId: lead.id });
      if (notify) tx.create(firestore.collection(COLECCIONES.NOTIFICACIONES).doc('sales_' + event.id), {
        id: 'sales_' + event.id, usuarioId: lead.userId, tipo: 'alerta_sistema', canal: 'in_app',
        titulo: 'Tu cuenta OfiAI', mensaje: interaction.message, estado: 'enviada', enviada: true,
        leida: false, intentos: 0, maxIntentos: 1, fechaCreacion: new Date(), fechaEnvio: new Date(),
        datos: { leadId: lead.id, source: 'sales' },
      });
      return saved;
    });
  }
  /** Busca seguimientos vencidos; no consulta toda la base. */
  async due(): Promise<SalesLead[]> {
    const docs = await firestore.collection(COLECCIONES.SALES_LEADS).where('followUpAt', '<=', new Date().toISOString())
      .where('followUpAt', '>', '').orderBy('followUpAt').limit(30).get();
    return docs.docs.map(doc => doc.data() as SalesLead);
  }
}
export const salesRepository = new SalesRepository();
