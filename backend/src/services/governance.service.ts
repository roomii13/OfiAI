/** @archivo governance.service.ts @descripcion Observabilidad administrativa y revision humana de calidad. */
import { z } from 'zod';
import { governanceRepository } from '../repositories/governance.repository';
import { orchestratorRepository } from '../repositories/orchestrator.repository';
import { supportRepository } from '../repositories/support.repository';
import { adminOnly,input } from '../validators/agent.validator';
import { salesIdSchema } from '../validators/sales.validator';
import type { AgentActor } from '../models/agent.model';
/** Expone metadatos y tasas con alcance temporal, no prompts ni secretos. */
export class GovernanceService {
  /** Agrega la ventana reciente; los costos desconocidos permanecen desconocidos. */
  async overview(actor: AgentActor) {
    adminOnly(actor);
    const observations=await governanceRepository.recent();
    const runs=await orchestratorRepository.list(actor.uid,true);
    const tickets=await supportRepository.tickets();
    const known=observations.filter(row=>row.estimatedCostUsd!==null);
    return {observations,runs,metrics:{
      observedCalls: observations.length,completed: observations.filter(row=>row.status==='completed').length,
      fallback: observations.filter(row=>row.status==='fallback').length,
      validationFailures: observations.reduce((sum,row)=>sum+row.validationFailures,0),
      averageLatencyMs: observations.length ? observations.reduce((sum,row)=>sum+row.durationMs,0)/observations.length : null,
      knownEstimatedCostUsd: known.length ? known.reduce((sum,row)=>sum+row.estimatedCostUsd!,0) : null,
      unknownCostCalls: observations.length-known.length,
      inputTokens: observations.reduce((sum,row)=>sum+row.providerCalls.reduce((n,p)=>n+(p.inputTokens??0),0),0),
      outputTokens: observations.reduce((sum,row)=>sum+row.providerCalls.reduce((n,p)=>n+(p.outputTokens??0),0),0),
      toolCalls: runs.reduce((sum,run)=>sum+run.steps.length,0),
      agentSuccess: runs.filter(run=>['completed','waiting_human','fallback'].includes(run.status)).length,
      agentFailure: runs.filter(run=>run.status==='failed').length,
      humanEscalation: tickets.filter(ticket=>ticket.status!=='resolved').length,
      hallucinationRate: null,
      suspectedHallucinations:observations.reduce((sum,row)=>sum+(row.reviewCounts?.suspected_hallucination??0),0),
      humanConfirmedIssues:observations.reduce((sum,row)=>sum+(row.reviewCounts?.confirmed_issue??0),0),
      humanAccepted:observations.reduce((sum,row)=>sum+(row.reviewCounts?.acceptable??0),0),
    },scope: 'Ultimas 100 observaciones, 50 ejecuciones y 50 tickets. No es un total historico.'};
  }
  /** Registra evaluacion humana, separada de errores automaticos de schema. */
  async feedback(actor: AgentActor,id: string,raw: unknown) {
    adminOnly(actor); input(salesIdSchema,id);
    const data=input(z.object({verdict: z.enum(['suspected_hallucination','confirmed_issue','acceptable'])}).strict(),raw);
    await governanceRepository.feedback(id,actor.uid,data.verdict); return {id,...data};
  }
}
export const governanceService=new GovernanceService();
