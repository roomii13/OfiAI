/** @archivo orchestrator.service.ts @descripcion Coordina servicios existentes sin inventar otra arquitectura ni contratos. */
import { z } from 'zod';
import { orchestratorRepository } from '../repositories/orchestrator.repository';
import { agentDataRepository } from '../repositories/agent-data.repository';
import { userRepository } from '../repositories/user.repository';
import { salesService } from './sales.service';
import { matchingService } from './matching.service';
import { pricingService } from './pricing.service';
import { coordinatorService } from './coordinator.service';
import { intelligenceService } from './intelligence.service';
import { salesIdSchema } from '../validators/sales.validator';
import { input } from '../validators/agent.validator';
import { toolAllowed, AGENT_POLICIES } from '../constants/agent-policy';
import { ApiError } from '../middleware/error.middleware';
import type { AgentActor } from '../models/agent.model';
import type { AgentRun } from '../../../shared/orchestrator';
import { aiUsageContext,type ProviderUsage } from '../monitoring/ai-usage';
import { governanceRepository } from '../repositories/governance.repository';
import { env } from '../config/env';
import { logger } from '../config/logger';

export const orchestrationSchema = z.object({ event: z.enum(['job.created','job.review','business.review','sales.review']),
  resourceId: salesIdSchema.optional(), requestId: z.string().uuid() }).strict();
/** Estado explicito, herramientas acotadas y reintentos sin contratar ni cobrar automaticamente. */
export class OrchestratorService {
  /** Despacha un evento aprobado por permisos del usuario actual. */
  async execute(actor: AgentActor,raw: unknown): Promise<AgentRun> {
    const data = input(orchestrationSchema,raw); const user = await userRepository.findById(actor.uid);
    if (!user?.activo || user.rol !== actor.rol) throw new ApiError('La cuenta no tiene permisos vigentes.',403);
    const jobEvent = data.event.startsWith('job.');
    if (jobEvent && (actor.rol !== 'empresa' || !data.resourceId)) throw new ApiError('Selecciona un trabajo propio desde una cuenta empresa.',403);
    if (jobEvent) await agentDataRepository.ownedJob(actor,data.resourceId!);
    if (data.event === 'sales.review' && actor.rol !== 'admin') throw new ApiError('Solo administracion puede revisar leads.',403);
    const claim = await orchestratorRepository.claim(actor.uid,data.event,data.resourceId ?? null,data.requestId);
    if (!claim.acquired) return claim.run;
    const run = claim.run; const started = Date.now(); const calls = new Map<string,number>();
    /** Solo ejecuta closures definidas por el servidor; no nombres o argumentos elegidos por un LLM. */
    async function invoke<T>(agent: string,tool: string,action: ()=>Promise<T>): Promise<T> {
      if (!toolAllowed(agent,tool,actor.rol) || (calls.get(agent) ?? 0) >= AGENT_POLICIES[agent]!.maxCalls)
        throw new ApiError('Herramienta no autorizada para este agente.',403);
      if (Date.now()-started > 90000) throw new ApiError('La ejecucion alcanzo su limite. Podes retomarla.',503);
      calls.set(agent,(calls.get(agent) ?? 0)+1);
      const at = Date.now(); let attempts = 0;
      while (true) {
        attempts++;
        try {
          const result = await action();
          run.steps.push({agent,tool,status: 'completed',durationMs: Date.now()-at,attempts,
            sourceIds: data.resourceId ? [data.resourceId] : [],decision: 'Herramienta permitida y datos con ownership.'});
          return result;
        } catch (error) {
          const retryable = error instanceof ApiError && error.codigoEstado === 503 && attempts < 2 && Date.now()-started < 60000;
          if (retryable) { await new Promise<void>(resolve=>setTimeout(resolve,500*attempts)); continue; }
          run.steps.push({agent,tool,status: 'failed',durationMs: Date.now()-at,attempts,
            sourceIds: [],decision: error instanceof ApiError && error.codigoEstado < 500 ? 'Accion rechazada por validacion o permisos.' : 'Dependencia no disponible.'});
          throw error;
        }
      }
    }
    const providerUsage:ProviderUsage[]=[];
    await aiUsageContext.run(providerUsage,async()=>{try {
      if (data.event === 'business.review') {
        const snapshot = await invoke('analytics','getIntelligence',()=>intelligenceService.snapshot(actor));
        run.result = {snapshot}; run.message = 'Analisis disponible con procedencia y limites.'; run.status = 'completed';
      } else if (data.event === 'sales.review') {
        if (!data.resourceId) throw new ApiError('Indica un lead.',400);
        const detail = await invoke('sales','getLead',()=>salesService.get(actor,data.resourceId));
        if (!detail) throw new ApiError('Lead no encontrado.',404);
        const lead = ['LEAD','QUALIFIED'].includes(detail.lead.stage)
          ? await invoke('sales','qualifyLead',()=>salesService.command(actor,data.resourceId!,{action: 'qualify',version: detail.lead.version}))
          : detail.lead;
        run.result = {assessment: lead.assessment,stage: lead.stage}; run.message = 'Lead analizado. Los contactos respetan el consentimiento.'; run.status = 'completed';
      } else {
        const job = await invoke('matching','getJob',()=>agentDataRepository.ownedJob(actor,data.resourceId!));
        if (['cancelado','borrador'].includes(job.estado)) throw new ApiError('El trabajo debe estar publicado y vigente.',409);
        if (job.estado === 'completado') {
          run.status = 'waiting_human'; run.message = 'El trabajo termino. Corresponde solicitar una resena verificada; no se inventan valoraciones.';
          run.result = {nextAgent: 'reputation',jobId: job.id};
        } else if (job.coordinationId) {
          const coordination = await invoke('coordinator','getCoordination',()=>coordinatorService.get(job.id,actor.uid,actor.rol));
          run.result = {state: coordination.workflow?.state ?? null,advice: coordination.advice};
          run.message = coordination.advice.message; run.status = 'waiting_human';
        } else {
          const matches = await invoke('matching','executeMatching',()=>matchingService.execute(job.id,actor.uid,actor.rol));
          if (matches.status === 'processing' || matches.status === 'pending') {
            run.result = {jobId: job.id,matchingStatus: matches.status};
            run.status = 'waiting_human'; run.message = 'Matching sigue procesando. Consulta el trabajo antes de avanzar.';
          } else {
            const pricing = await invoke('pricing','executePricing',()=>pricingService.execute(job.id,actor.uid,actor.rol));
            run.result = {jobId: job.id,matches: matches.matches.length,matchingStatus: matches.status,
              selectedProfessionalId: matches.selectedProfessionalId,pricingReady: Boolean(pricing.result),nextAgent: 'coordinator'};
            run.status = matches.fallbackUsed ? 'fallback' : 'waiting_human';
            run.message = matches.matches.length ? 'Matching y Pricing revisados. La seleccion y los acuerdos requieren confirmacion de la empresa.'
              : 'No se encontraron candidatos. La estimacion no implica una contratacion.';
          }
        }
      }
    } catch (error) {
      run.status = 'failed'; run.message = error instanceof ApiError ? error.message : 'No se pudo completar el recorrido. Los datos confirmados siguen guardados.';
    }
    });
    run.updatedAt = new Date().toISOString(); run.durationMs = Date.now()-started;
    if(providerUsage.length) {
      let cost:number|null=0;
      for(const row of providerUsage) {
        const rate=env.AI_COST_RATES_JSON[row.provider];
        if(!rate||row.inputTokens===null||row.outputTokens===null){cost=null;break;}
        cost+=(row.inputTokens*rate.inputUsdPerMillion+row.outputTokens*rate.outputUsdPerMillion)/1000000;
      }
      try{await governanceRepository.record({ownerId:actor.uid,agent:'orchestrator',
        status:run.status==='failed'?'failed':run.status==='fallback'?'fallback':'completed',
        startedAt:new Date(started).toISOString(),durationMs:run.durationMs,providerCalls:providerUsage,
        estimatedCostUsd:cost,costBasis:cost===null?'unavailable':'configured_rates',validationFailures:0,
        fallbackReason:run.status==='fallback'?'deterministic_matching':null,promptVersion:'existing_job_agents'});}
      catch{logger.warn('Telemetria de orquestacion no disponible.',{runId:run.id});}
    }
    return orchestratorRepository.finish(run);
  }
  /** Consulta una corrida con ownership. */
  async get(actor: AgentActor,id: string) { input(salesIdSchema,id); return orchestratorRepository.get(id,actor.uid,actor.rol === 'admin'); }
  /** Bandeja de ejecuciones propia o administrativa. */
  async list(actor: AgentActor) { return orchestratorRepository.list(actor.uid,actor.rol === 'admin'); }
}
export const orchestratorService = new OrchestratorService();
