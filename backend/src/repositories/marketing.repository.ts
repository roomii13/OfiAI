/** @archivo marketing.repository.ts @descripcion Campanas privadas y entregas internas exactamente una vez. */
import { createHash } from 'node:crypto';
import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES as C } from '../database/firestore/collections';
import { FieldPath } from 'firebase-admin/firestore';
import { ApiError } from '../middleware/error.middleware';
import type { MarketingCampaign, MarketingReport } from '../models/marketing.model';
import type { SalesLead } from '../models/sales.model';
/** Repositorio de campanas y evidencias, separado de las decisiones del agente. */
export class MarketingRepository {
  /** Editar invalida aprobacion; una campana que ya envio contenido se conserva inmutable. */
  async content(id:string,version:number,variants:MarketingCampaign['variants']):Promise<void> {
    const ref=firestore.collection(C.MARKETING_CAMPAIGNS).doc(id);
    await firestore.runTransaction(async tx=>{
      const current=(await tx.get(ref)).data() as MarketingCampaign|undefined;
      if(!current)throw new ApiError('Campana no encontrada.',404);
      if(current.version!==version||current.delivered>0||current.status==='completed')throw new ApiError('No se puede editar esta version. Crea otra campana.',409);
      tx.update(ref,{variants,status:'draft',approvedBy:null,version:version+1,updatedAt:new Date().toISOString()});
    });
  }
  /** Guarda una nueva campana; nunca se publica al crearla. */
  async create(campaign: Omit<MarketingCampaign, 'id'>): Promise<MarketingCampaign> {
    const ref = firestore.collection(C.MARKETING_CAMPAIGNS).doc(); const saved = { ...campaign, id: ref.id };
    await ref.create(saved); return saved;
  }
  /** Consulta un documento interno. */
  async get(id: string): Promise<MarketingCampaign | null> {
    const doc = await firestore.collection(C.MARKETING_CAMPAIGNS).doc(id).get();
    return doc.exists ? doc.data() as MarketingCampaign : null;
  }
  /** Lista los cincuenta borradores/campanas mas recientes. */
  async list(): Promise<MarketingCampaign[]> {
    const docs = await firestore.collection(C.MARKETING_CAMPAIGNS).orderBy('createdAt', 'desc').limit(50).get();
    return docs.docs.map(doc => doc.data() as MarketingCampaign);
  }
  /** Cambia estado con version y conserva quien aprobo el contenido. */
  async state(id: string, version: number, status: 'approved' | 'paused', uid: string): Promise<void> {
    const ref = firestore.collection(C.MARKETING_CAMPAIGNS).doc(id);
    await firestore.runTransaction(async tx => {
      const doc = await tx.get(ref); const current = doc.data() as MarketingCampaign | undefined;
      if (!current) throw new ApiError('Campana no encontrada.', 404);
      if (current.version !== version || current.status === 'completed') throw new ApiError('La campana cambio o ya finalizo.', 409);
      tx.update(ref, { status, approvedBy: status === 'approved' ? uid : current.approvedBy, version: version + 1, updatedAt: new Date().toISOString() });
    });
  }
  /** Evidencia declarada inmutable; no se contabiliza como cobro verificado. */
  async report(report: MarketingReport): Promise<void> {
    const ref = firestore.collection(C.MARKETING_CAMPAIGNS).doc(report.campaignId).collection('reports').doc(report.id);
    await firestore.runTransaction(async tx => {
      if ((await tx.get(ref)).exists) throw new ApiError('Ese reporte ya existe. Utiliza una nueva referencia para una correccion.', 409);
      tx.create(ref, report);
    });
  }
  /** Devuelve evidencia y formulas por separado del ledger financiero. */
  async reports(id: string): Promise<MarketingReport[]> {
    const docs = await firestore.collection(C.MARKETING_CAMPAIGNS).doc(id).collection('reports').orderBy('createdAt','desc').limit(50).get();
    return docs.docs.map(doc => doc.data() as MarketingReport);
  }
  /** Envia un lote in-app; revalida consentimiento, estado, usuario y frecuencia en transaccion. */
  async dispatch(campaign: MarketingCampaign): Promise<number> {
    let query = firestore.collection(C.SALES_LEADS).orderBy(FieldPath.documentId()).limit(20);
    if (campaign.cursor) query = query.startAfter(campaign.cursor);
    const page = await query.get(); const ref = firestore.collection(C.MARKETING_CAMPAIGNS).doc(campaign.id);
    return firestore.runTransaction(async tx => {
      const currentDoc = await tx.get(ref); const current = currentDoc.data() as MarketingCampaign;
      if (current?.status !== 'approved' || current.version !== campaign.version) throw new ApiError('La campana cambio. Actualiza antes de continuar.', 409);
      const leadDocs = page.empty ? [] : await tx.getAll(...page.docs.map(doc => doc.ref));
      const recipients = leadDocs.map(doc => doc.data() as SalesLead).filter(lead => lead.consent && lead.audience === current.audience && current.stages.includes(lead.stage));
      const users = recipients.length ? await tx.getAll(...recipients.map(lead => firestore.collection(C.USUARIOS).doc(lead.userId))) : [];
      const receiptRefs = recipients.map(lead => ref.collection('deliveries').doc(lead.id));
      const receipts = receiptRefs.length ? await tx.getAll(...receiptRefs) : [];
      const lastRefs = recipients.map(lead => firestore.collection(C.SALES_LEADS).doc(lead.id).collection('delivery_state').doc('marketing'));
      const last = lastRefs.length ? await tx.getAll(...lastRefs) : [];
      let delivered = 0;
      recipients.forEach((lead,index) => {
        if (!users[index]?.data()?.activo || receipts[index]?.exists || (Date.parse(String(last[index]?.data()?.at ?? '')) + 7 * 86400000 > Date.now())) return;
        const variant = current.variants[parseInt(createHash('sha256').update(current.id + ':' + lead.id).digest('hex').slice(0,8),16) % current.variants.length]!;
        const id = 'marketing_' + current.id + '_' + lead.id;
        tx.create(firestore.collection(C.NOTIFICACIONES).doc(id), { id, usuarioId: lead.userId, tipo: 'alerta_sistema', canal: 'in_app',
          titulo: variant.title, mensaje: variant.body + '\n' + variant.cta, estado: 'enviada', enviada: true, leida: false,
          intentos: 0, maxIntentos: 1, fechaCreacion: new Date(), fechaEnvio: new Date(),
          datos: { campaignId: current.id, variantId: variant.id } });
        tx.create(receiptRefs[index]!, { variantId: variant.id, at: new Date().toISOString() });
        tx.set(lastRefs[index]!, { at: new Date().toISOString() }); delivered++;
      });
      tx.update(ref, { cursor: page.docs.at(-1)?.id ?? current.cursor, delivered: current.delivered + delivered,
        status: page.size < 20 ? 'completed' : 'approved', version: current.version + 1, updatedAt: new Date().toISOString() });
      return delivered;
    });
  }
}
export const marketingRepository = new MarketingRepository();
