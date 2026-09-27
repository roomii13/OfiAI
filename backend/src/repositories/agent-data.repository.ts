/** @archivo agent-data.repository.ts @descripcion Proyecciones minimas con ownership para herramientas de agentes. */
import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES as C } from '../database/firestore/collections';
import { ApiError } from '../middleware/error.middleware';
import type { AgentActor } from '../models/agent.model';
import type { Trabajo } from '../models/Job';
import type { Profesional } from '../models/Professional';
import { input } from '../validators/agent.validator';
import { salesIdSchema } from '../validators/sales.validator';
import { subscriptionRepository } from './subscription.repository';

/** Ningun metodo acepta rutas arbitrarias de colecciones. */
export class AgentDataRepository {
  /** Resuelve perfiles desde el UID autenticado. */
  async entity(actor: AgentActor): Promise<string | null> {
    if (actor.rol === 'admin') return null;
    const docs = await firestore.collection(actor.rol === 'empresa' ? C.EMPRESAS : C.PROFESIONALES)
      .where('usuarioId','==',actor.uid).select('id').limit(1).get();
    return docs.docs[0]?.id ?? null;
  }
  /** Retorna un trabajo solo a la empresa, profesional asignado o administrador. */
  async ownedJob(actor: AgentActor, id: string): Promise<Trabajo> {
    input(salesIdSchema,id); const doc = await firestore.collection(C.TRABAJOS).doc(id).get();
    const job = doc.exists ? doc.data() as Trabajo : null;
    const entity = await this.entity(actor);
    if (!job || (actor.rol !== 'admin' && (!entity || (actor.rol === 'empresa' ? job.empresaId !== entity : job.profesionalAsignadoId !== entity))))
      throw new ApiError('Trabajo no encontrado.',404);
    return { ...job, id: doc.id };
  }
  /** Omite direccion exacta, presupuestos de terceros y adjuntos privados. */
  async getJob(actor: AgentActor, id: string) {
    const job = await this.ownedJob(actor,id);
    return { id: job.id, title: job.titulo, status: job.estado, category: job.categoria, city: job.ciudad ?? null,
      preferredDate: job.preferredDate ?? null, coordinationState: job.coordinationState ?? null };
  }
  /** Solo consulta el contrato del titular incluso si tiene rol admin. */
  async getSubscription(actor: AgentActor) {
    const value = await subscriptionRepository.findCurrentByUserId(actor.uid);
    return value ? { id: value.id, plan: value.plan, status: value.estado==='activa'&&value.plan!=='gratuito'&&value.fechaVencimiento<new Date()?'vencida':value.estado, currency: value.moneda,
      monthlyPrice: value.precioMensual, autoRenew: value.renovacionAutomatica, periodEnd: value.fechaVencimiento.toISOString() } : null;
  }
  /** Recibo de pago propio; no lo presenta como factura fiscal. */
  async getInvoice(actor: AgentActor, id: string) {
    input(salesIdSchema,id);
    const found = await subscriptionRepository.payment(id);
    if (!found || found.usuarioId!==actor.uid) throw new ApiError('Recibo no encontrado.',404);
    return { id: found.id, amountMinor: found.amountMinor, currency: found.currency, paidAt: found.paidAt,
      status: found.status, refundedMinor: found.refundedMinor, fiscalInvoice: false };
  }
  /** Proyeccion publica de perfil activo sin contacto ni informacion de cuenta. */
  async getProfessional(_actor: AgentActor, id: string) {
    input(salesIdSchema,id); const doc = await firestore.collection(C.PROFESIONALES).doc(id).get();
    const profile = doc.exists ? doc.data() as Profesional : null;
    if (!profile || profile.activo === false || profile.status === 'suspended' || profile.status === 'inactive')
      throw new ApiError('Profesional no encontrado.',404);
    return { id: doc.id, name: profile.nombre + ' ' + profile.apellido, categories: profile.categorias,
      city: profile.ciudad, experience: profile.aniosExperiencia, available: profile.disponible, verified: profile.verificado };
  }
}
export const agentDataRepository = new AgentDataRepository();
