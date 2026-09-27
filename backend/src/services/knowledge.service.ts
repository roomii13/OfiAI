/** @archivo knowledge.service.ts @descripcion Memoria por usuario/empresa/job y conocimiento aprobado de OfiAI. */
import { z } from 'zod';
import { knowledgeRepository } from '../repositories/knowledge.repository';
import { agentDataRepository } from '../repositories/agent-data.repository';
import { input,adminOnly } from '../validators/agent.validator';
import { knowledgeScopeSchema,knowledgeInputSchema,knowledgeQuerySchema } from '../validators/knowledge.validator';
import { salesIdSchema } from '../validators/sales.validator';
import { retrieveKnowledge } from '../ai/tools/knowledge.tool';
import { ApiError } from '../middleware/error.middleware';
import type { AgentActor } from '../models/agent.model';
import type { KnowledgeScope,KnowledgeSearch } from '../../../shared/knowledge';
/** Ningun scopeKey ni ownerId se acepta desde el frontend. */
export class KnowledgeService {
  /** Deriva el alcance a partir del usuario actual y un Job validado. */
  private async key(actor: AgentActor,scope: KnowledgeScope,jobId?: string): Promise<string> {
    if(scope==='platform') return 'platform';
    if(scope==='private') return 'user:'+actor.uid;
    if(scope==='organization') {
      if(actor.rol!=='empresa') throw new ApiError('Se requiere una cuenta empresa.',403);
      const entity=await agentDataRepository.entity(actor);
      if(!entity) throw new ApiError('Empresa no encontrada.',404);
      return 'company:'+entity;
    }
    if(!jobId) throw new ApiError('Indica el trabajo.',400);
    await agentDataRepository.ownedJob(actor,jobId);
    return 'job:'+jobId+':user:'+actor.uid;
  }
  /** Guarda memoria consentida. La documentacion global requiere revision administrativa. */
  async create(actor: AgentActor,raw: unknown) {
    const data=input(knowledgeInputSchema,raw);
    if(data.scope==='platform') adminOnly(actor);
    const scopeKey=await this.key(actor,data.scope,data.jobId); const now=new Date().toISOString();
    return knowledgeRepository.create({ownerId: actor.uid,scope: data.scope,scopeKey,jobId: data.jobId ?? null,
      title: data.title,text: data.text,kind: data.kind,published: data.scope!=='platform',
      version: 1,createdAt: now,updatedAt: now,expiresAt: new Date(Date.now()+data.retentionDays*86400000).toISOString()});
  }
  /** Lista el alcance solicitado sin revelar documentos de otras organizaciones. */
  async list(actor: AgentActor,scope: unknown,jobId?: string) {
    const parsed=input(knowledgeScopeSchema,scope);
    return knowledgeRepository.list(await this.key(actor,parsed,jobId),parsed!=='platform'||actor.rol==='admin');
  }
  /** Recuperacion para RAG: solo fragmentos publicados y referencias verificadas. */
  async search(actor: AgentActor,raw: unknown): Promise<KnowledgeSearch> {
    const data=input(knowledgeQuerySchema,raw); const key=await this.key(actor,data.scope,data.jobId);
    const result=await knowledgeRepository.list(key);
    return {method: 'lexical',embeddingsEnabled: false,hits: retrieveKnowledge(data.query,result.documents),
      scanned: result.documents.length,partial: result.partial};
  }
  /** Revoca memoria o publica una version concreta de conocimiento global. */
  async command(actor: AgentActor,id: string,raw: unknown) {
    input(salesIdSchema,id);
    const data=input(z.object({version: z.number().int().positive(),action: z.enum(['publish','delete'])}).strict(),raw);
    const document=await knowledgeRepository.get(id);
    const key=await this.key(actor,document.scope,document.jobId ?? undefined);
    if(key!==document.scopeKey || (document.ownerId!==actor.uid && !(document.scope==='platform' && actor.rol==='admin')))
      throw new ApiError('Documento no encontrado.',404);
    if(document.scope==='platform') adminOnly(actor);
    await knowledgeRepository.change(id,actor.uid,data.version,data.action); return {id,action: data.action};
  }
}
export const knowledgeService=new KnowledgeService();
