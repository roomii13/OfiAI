/** @archivo support.service.ts @descripcion Soporte contextual con herramientas autorizadas y escalamiento. */
import { randomUUID } from 'node:crypto';
import { supportAgent } from '../ai/agents/support.agent';
import { supportTool } from '../ai/tools/support.tool';
import { supportRepository } from '../repositories/support.repository';
import { supportStartSchema, supportMessageSchema, ticketCommandSchema } from '../validators/support.validator';
import { salesIdSchema } from '../validators/sales.validator';
import { input, adminOnly } from '../validators/agent.validator';
import type { AgentActor } from '../models/agent.model';
import type { SupportTicket } from '../../../shared/support';
import { ApiError } from '../middleware/error.middleware';
import { knowledgeService } from './knowledge.service';
/** Controla contexto y permisos; el agente no recibe repositorios ni SDKs. */
export class SupportService {
  /** Inicia una conversacion despues de validar el recurso asociado. */
  async start(actor: AgentActor, raw: unknown) {
    const data = input(supportStartSchema,raw);
    if (data.resource) await supportTool(actor,data.resource);
    return supportRepository.create(actor.uid,data.resource ?? null);
  }
  /** Recupera conversaciones propias. */
  async list(actor: AgentActor) { return supportRepository.list(actor.uid); }
  /** Recupera contexto del titular. */
  async get(actor: AgentActor,id: string) { input(salesIdSchema,id); return supportRepository.get(id,actor.uid); }
  /** Consulta el recurso actual en cada turno, nunca datos privados aportados por el cliente. */
  async message(actor: AgentActor,id: string,raw: unknown) {
    const data = input(supportMessageSchema,raw); const session = await this.get(actor,id);
    if (session.version !== data.version && !session.messages.some(message => message.id === data.requestId))
      throw new ApiError('La conversacion cambio. Actualiza antes de enviar.',409);
    if (session.messages.some(message => message.id === data.requestId)) return session;
    const facts = session.resource ? await supportTool(actor,session.resource) : null;
    const response = supportAgent.responder({ mensaje: data.message, rolUsuario: actor.rol,
      contexto: session.messages.slice(-6).map(message => message.text).join('\n') });
    const incident = /fraude|robo|hack|cobro duplicado|reclamo|humano|persona|no funciona|error/i.test(data.message);
    const category: SupportTicket['category'] = /fraude|robo|hack/i.test(data.message) ? 'security'
      : /cobro|pago|factur/i.test(data.message) ? 'billing' : session.resource?.tool === 'getJob' ? 'job' : 'general';
    const escalation = incident ? { category, priority: category === 'security' ? 'high' as const : 'normal' as const } : null;
    const knowledge = !facts ? await knowledgeService.search(actor,{scope: 'platform',query: data.message.slice(0,500)}) : null;
    if(knowledge) {
      const personal=await knowledgeService.search(actor,{scope:'private',query:data.message.slice(0,500)});
      knowledge.hits=[...personal.hits,...knowledge.hits].slice(0,8);
    }
    if(knowledge) knowledge.hits=await supportAgent.selectKnowledge(actor,data.message,knowledge.hits,
      session.messages.slice(-4).map(message=>message.text).join('\n'));
    const grounded = facts ? supportAgent.explainFacts(session.resource!.tool,facts)
      : knowledge?.hits.length ? knowledge.hits.map(hit => hit.title + ': ' + hit.excerpt).join('\n\n') : response.respuesta;
    const text = (session.status === 'escalated' ? 'Tu caso sigue pendiente de atencion humana. ' : '')
      + grounded + (incident ? ' Registre tu caso para que lo revise una persona. No se hicieron cambios ni cobros.' : '');
    const now = new Date().toISOString();
    return supportRepository.append(session,data.requestId, [
      { id: data.requestId, author: 'user', text: data.message, at: now, sources: [] },
      { id: randomUUID(), author: 'agent', text, at: now, sources: session.resource ? [session.resource.tool]
        : knowledge?.hits.length ? knowledge.hits.map(hit => hit.documentId + '@' + hit.version) : ['ofiai_support_rules_v1'] },
    ],escalation);
  }
  /** Bandeja exclusivamente humana con privilegios administrativos. */
  async tickets(actor: AgentActor) { adminOnly(actor); return supportRepository.tickets(); }
  /** Consulta humana explicita, no busqueda libre por toda la base. */
  async ticket(actor: AgentActor,id: string) { adminOnly(actor); input(salesIdSchema,id); return supportRepository.ticket(id); }
  /** Acciones humanas auditadas. */
  async command(actor: AgentActor,id: string,raw: unknown) {
    adminOnly(actor); input(salesIdSchema,id); const data = input(ticketCommandSchema,raw);
    return supportRepository.resolve(id,actor.uid,data.version,data.action,data.message);
  }
}
export const supportService = new SupportService();
