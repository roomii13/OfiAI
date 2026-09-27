/** @archivo intelligence.repository.ts @descripcion Lecturas analiticas acotadas y filtradas antes de acceder a datos. */
import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES as C } from '../database/firestore/collections';
import { agentDataRepository } from './agent-data.repository';
import { subscriptionRepository } from './subscription.repository';
import type { AgentActor } from '../models/agent.model';
import type { Trabajo } from '../models/Job';
import type { Suscripcion } from '../models/Subscription';
import { billingDate } from '../utils/billing';
/** Normaliza tiempo legacy sin interpretar fechas inexistentes como hoy. */
export function evidenceTime(value: unknown): number {
  try { return billingDate(value).getTime(); } catch { return NaN; }
}
/** Acceso analitico; ninguna empresa puede pedir el dataset de otra. */
export class IntelligenceRepository {
  /** Recupera como maximo 500 trabajos y marca truncamiento en la respuesta. */
  async source(actor: AgentActor,month: string) {
    const entity = await agentDataRepository.entity(actor);
    const root = firestore.collection(C.TRABAJOS);
    const query = actor.rol === 'admin' ? root : root.where(actor.rol === 'empresa' ? 'empresaId' : 'profesionalAsignadoId','==',entity ?? '__no_profile__');
    const docs = await query.select('titulo','categoria','ciudad','estado','preferredDate','fechaFin','fechaCreacion',
      'fechaActualizacion','profesionalAsignadoId','coordinationState').limit(501).get();
    const total = await query.count().get();
    const jobs = docs.docs.slice(0,500).map(doc => ({ ...doc.data(), id: doc.id })) as Trabajo[];
    const payments = actor.rol === 'admin' ? null : await subscriptionRepository.payments(actor.uid);
    const revenue = actor.rol === 'admin' ? await subscriptionRepository.revenue(month) : [];
    let subscriptions: Suscripcion[] = []; let subscriptionPartial = false;
    let supply: Array<{ city: string; categories: string[] }> = []; let supplyPartial = false;
    let events: Array<{ uid: string; at: number }> = []; let eventsPartial = false;
    if (actor.rol === 'admin') {
      const subs = await firestore.collection(C.SUSCRIPCIONES).where('estado','==','activa')
        .select('plan','precioMensual','moneda','fechaVencimiento','usuarioId').limit(501).get();
      subscriptionPartial = subs.size > 500; subscriptions = subs.docs.slice(0,500).map(doc => doc.data() as Suscripcion);
      const profiles = await firestore.collection(C.PROFESIONALES).where('disponible','==',true)
        .select('ciudad','categorias','status','activo').limit(501).get();
      supplyPartial = profiles.size > 500;
      supply = profiles.docs.slice(0,500).filter(doc => doc.data().activo !== false && !['inactive','suspended'].includes(doc.data().status))
        .map(doc => ({ city: String(doc.data().ciudad ?? 'Sin ciudad'), categories: Array.isArray(doc.data().categorias) ? doc.data().categorias as string[] : [] }));
      const activity = await firestore.collection(C.ANALYTICS_EVENTOS).where('fechaCreacion','>=',new Date(Date.now()-30*86400000))
        .select('usuarioId','tipo','fechaCreacion').limit(5001).get();
      eventsPartial = activity.size > 5000;
      events = activity.docs.slice(0,5000).filter(doc => ['login','trabajo_creado','propuesta_enviada','consulta_ia'].includes(doc.data().tipo)
        && typeof doc.data().usuarioId === 'string').map(doc => ({ uid: doc.data().usuarioId as string, at: evidenceTime(doc.data().fechaCreacion) }));
    }
    return { jobs, total: total.data().count, jobsPartial: docs.size > 500, payments, revenue, subscriptions,
      subscriptionPartial, supply, supplyPartial, events, eventsPartial };
  }
}
export const intelligenceRepository = new IntelligenceRepository();
