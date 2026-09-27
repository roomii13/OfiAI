/** @archivo sales.service.ts @descripcion Calificacion y seguimiento de cuentas propias con consentimiento. */
import { salesAgent } from '../ai/agents/sales.agent';
import { salesRepository } from '../repositories/sales.repository';
import { userRepository } from '../repositories/user.repository';
import { subscriptionRepository } from '../repositories/subscription.repository';
import { subscriptionService } from './subscription.service';
import { salesIdSchema, salesInputSchema, salesAdminSchema, salesReplySchema } from '../validators/sales.validator';
import { adminOnly, input } from '../validators/agent.validator';
import { ApiError } from '../middleware/error.middleware';
import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES } from '../database/firestore/collections';
import { hasPaidAccess } from '../utils/billing';
import type { AgentActor } from '../models/agent.model';
import type { SalesLead, SalesOverview, SalesStage } from '../models/sales.model';

/** Gestiona el embudo sin permitir que una IA conceda acceso de pago. */
export class SalesService {
  /** Sigue consultas autorizadas con maximo tres contactos y pausa entre mensajes. */
  async followUp(): Promise<number> {
    let processed = 0;
    for (const lead of await salesRepository.due()) {
      if (!lead.consent || ['CUSTOMER', 'LOST'].includes(lead.stage) || lead.followUps >= 3) continue;
      const user = await userRepository.findById(lead.userId);
      if (!user?.activo) continue;
      const subscription=await subscriptionRepository.findCurrentByUserId(lead.userId);
      const payments=hasPaidAccess(subscription)?await subscriptionRepository.payments(lead.userId):[];
      if(payments.some(payment=>payment.status==='approved'&&payment.amountMinor>payment.refundedMinor)) {
        try {await salesRepository.save({...lead,stage:'CUSTOMER',followUpAt:null},lead.version,
          {kind:'conversion',actor:'system',message:'Cliente verificado contra facturacion.',createdAt:new Date().toISOString()});processed++;}
        catch(error){if(!(error instanceof ApiError&&error.codigoEstado===409))throw error;}
        continue;
      }
      const plans = subscriptionService.listarPlanes(lead.audience);
      const updated = { ...lead, assessment: salesAgent.assess(lead, plans), followUps: lead.followUps + 1 };
      updated.followUpAt = updated.followUps < 3 ? new Date(Date.now() + 3 * 86400000).toISOString() : null;
      if (['LEAD', 'QUALIFIED'].includes(updated.stage)) updated.stage = 'CONTACTED';
      try {
        await salesRepository.save(updated, lead.version, { kind: 'message', actor: 'system',
          message: salesAgent.message(updated, plans.find(plan => plan.id === updated.assessment.recommendedPlan)?.nombre ?? 'FREE'),
          createdAt: new Date().toISOString() }, true);
        processed++;
      } catch (error) { if (!(error instanceof ApiError && error.codigoEstado === 409)) throw error; }
    }
    return processed;
  }
  /** Alta/actualizacion voluntaria; el cliente no elige UID ni datos de otra empresa. */
  async optIn(actor: AgentActor, raw: unknown) {
    if (actor.rol === 'admin') throw new ApiError('Usa una cuenta empresa o profesional.', 403);
    const data = input(salesInputSchema, raw); const user = await userRepository.findById(actor.uid);
    if (!user?.activo) throw new ApiError('Cuenta no disponible.', 403);
    const existing = await salesRepository.get(actor.uid);
    const company = actor.rol === 'empresa' ? (await firestore.collection(COLECCIONES.EMPRESAS)
      .where('usuarioId', '==', actor.uid).select('nombre', 'nombreEmpresa', 'ciudad').limit(1).get()).docs[0]?.data() : null;
    const now = new Date().toISOString();
    const lead: SalesLead = { id: actor.uid, userId: actor.uid, name: user.nombre, audience: actor.rol,
      companyName: typeof company?.nombreEmpresa === 'string' ? company.nombreEmpresa : null,
      city: typeof company?.ciudad === 'string' ? company.ciudad : null,
      stage: existing?.stage ?? 'LEAD', need: data.need, expectedMonthlyVolume: data.expectedMonthlyVolume,
      consent: data.consent, consentUpdatedAt: now, assessment: existing?.assessment ?? {
        score: 0, intent: 'exploring', reasons: [], recommendedPlan: 'gratuito', nextAction: '', abandoned: false },
      followUpAt: data.consent ? new Date(Date.now() + 2 * 86400000).toISOString() : null,
      followUps: existing?.followUps ?? 0, lastActivityAt: now, createdAt: existing?.createdAt ?? now,
      updatedAt: now, version: existing?.version ?? 0 };
    lead.assessment = salesAgent.assess(lead, subscriptionService.listarPlanes(actor.rol));
    lead.assessment = await salesAgent.enrich(actor,lead);
    return salesRepository.save(lead, lead.version, { kind: existing ? 'consent' : 'created',
      actor: 'user', message: data.consent ? 'Contacto comercial autorizado.' : 'Contacto comercial desactivado.', createdAt: now });
  }
  /** Un titular solo puede recuperar su propio lead. */
  async get(actor: AgentActor, id = actor.uid) {
    input(salesIdSchema, id);
    if (actor.rol !== 'admin' && id !== actor.uid) throw new ApiError('Lead no encontrado.', 404);
    const lead = await salesRepository.get(id);
    return lead ? salesRepository.detail(lead) : null;
  }
  /** La tasa publicada se acota explicitamente a la pagina observada. */
  async list(actor: AgentActor, cursor?: string): Promise<SalesOverview> {
    adminOnly(actor); if (cursor) input(salesIdSchema, cursor);
    const page = await salesRepository.list(cursor);
    const stages: Record<SalesStage, number> = { LEAD: 0, QUALIFIED: 0, CONTACTED: 0, INTERESTED: 0, TRIAL: 0, CUSTOMER: 0, LOST: 0 };
    page.leads.forEach(lead => stages[lead.stage]++);
    return { ...page, leads: page.leads.sort((a,b) => b.assessment.score - a.assessment.score), stages,
      conversionRate: page.leads.length ? stages.CUSTOMER / page.leads.length : null,
      total: page.leads.length, metricsScope: 'page' };
  }
  /** Actualiza intencion con una respuesta real del titular. */
  async reply(actor: AgentActor, raw: unknown) {
    const data = input(salesReplySchema, raw); const lead = await salesRepository.get(actor.uid);
    if (!lead) throw new ApiError('Primero guarda tus preferencias comerciales.', 404);
    const updated = { ...lead, need: data.message, lastActivityAt: new Date().toISOString(), followUps: 0 };
    updated.assessment = salesAgent.assess(updated, subscriptionService.listarPlanes(lead.audience));
    if (updated.assessment.intent === 'purchase' && lead.stage !== 'CUSTOMER') updated.stage = 'INTERESTED';
    return salesRepository.save(updated, lead.version, { kind: 'reply', actor: 'user', message: data.message, createdAt: updated.lastActivityAt });
  }
  /** Transiciones validas con control de version; TRIAL no habilita prestaciones. */
  async command(actor: AgentActor, id: string, raw: unknown) {
    adminOnly(actor); input(salesIdSchema, id); const data = input(salesAdminSchema, raw);
    const lead = await salesRepository.get(id);
    if (!lead) throw new ApiError('Lead no encontrado.', 404);
    const user = await userRepository.findById(lead.userId);
    if (!user?.activo) throw new ApiError('La cuenta esta suspendida.', 409);
    const plans = subscriptionService.listarPlanes(lead.audience);
    const updated = { ...lead, assessment: salesAgent.assess(lead, plans) };
    if(data.action==='qualify') updated.assessment=await salesAgent.enrich(actor,updated);
    const next: Partial<Record<typeof data.action, SalesStage>> = {
      qualify: 'QUALIFIED', contact: 'CONTACTED', interested: 'INTERESTED', trial: 'TRIAL', lost: 'LOST', recover: 'QUALIFIED' };
    const allowed: Record<string, SalesStage[]> = { qualify: ['LEAD','QUALIFIED'], contact: ['LEAD','QUALIFIED','CONTACTED','INTERESTED','TRIAL'],
      interested: ['CONTACTED','QUALIFIED'], trial: ['INTERESTED'], lost: ['LEAD','QUALIFIED','CONTACTED','INTERESTED','TRIAL'], recover: ['LOST'] };
    let message = 'Etapa comercial actualizada.'; let kind: 'qualified' | 'message' | 'stage' | 'conversion' = 'stage';
    if (data.action === 'sync') {
      const subscription = await subscriptionRepository.findCurrentByUserId(lead.userId);
      const payments = await subscriptionRepository.payments(lead.userId);
      if (!hasPaidAccess(subscription) || !payments.some(payment => payment.status === 'approved' && payment.amountMinor > payment.refundedMinor))
        throw new ApiError('No hay un periodo pago confirmado para convertir este lead.', 409);
      updated.stage = 'CUSTOMER'; updated.followUpAt = null; kind = 'conversion'; message = 'Cliente verificado contra facturacion.';
    } else {
      if (!allowed[data.action]?.includes(lead.stage)) throw new ApiError('La transicion no corresponde al estado actual.', 409);
      updated.stage = next[data.action]!;
      if (data.action === 'qualify') kind = 'qualified';
      if (data.action === 'contact') {
        if (!lead.consent) throw new ApiError('Falta consentimiento del titular.', 409);
        if (lead.followUps >= 3) throw new ApiError('Se alcanzo el limite de tres contactos. Espera una respuesta.', 409);
        if (lead.followUps > 0 && lead.followUpAt && Date.parse(lead.followUpAt) > Date.now())
          throw new ApiError('El proximo seguimiento todavia no vence.', 409);
        message = salesAgent.message(updated, plans.find(plan => plan.id === updated.assessment.recommendedPlan)?.nombre ?? 'FREE');
        updated.followUps++; updated.followUpAt = updated.followUps < 3 ? new Date(Date.now() + 3 * 86400000).toISOString() : null;
        kind = 'message';
      }
      if (data.action === 'lost') updated.followUpAt = null;
      if (data.action === 'recover') updated.followUpAt = lead.consent ? new Date(Date.now() + 3 * 86400000).toISOString() : null;
    }
    return salesRepository.save(updated, data.version, { kind, actor: 'admin', message, createdAt: new Date().toISOString() }, data.action === 'contact');
  }
}
export const salesService = new SalesService();
