/** @archivo operations.service.ts @descripcion Operacion interna y BI con metricas de procedencia explicita. */
import { z } from 'zod';
import { operationsRepository } from '../repositories/operations.repository';
import { intelligenceService } from './intelligence.service';
import { governanceService } from './governance.service';
import { adminOnly,input } from '../validators/agent.validator';
import { salesIdSchema } from '../validators/sales.validator';
import { redactSecrets } from '../validators/support.validator';
import type { AgentActor } from '../models/agent.model';
import type { CommandCenter } from '../../../shared/operations';
const listSchema=z.object({resource:z.enum(['users','companies','professionals','jobs','subscriptions','transactions','matches']),
  cursor:salesIdSchema.optional(),jobId:salesIdSchema.optional()}).strict().refine(value=>value.resource!=='matches'||Boolean(value.jobId),'Indica un Job.');
/** Operaciones humanas explicitas, auditadas y nunca ejecutadas por un prompt. */
export class OperationsService {
  /** Proyecciones paginadas para revisar el estado real de la plataforma. */
  async list(actor:AgentActor,raw:unknown) {
    adminOnly(actor);const data=input(listSchema,raw);return operationsRepository.list(data.resource,data.cursor,data.jobId);
  }
  /** Acciones de moderacion con motivo obligatorio y sin permisos financieros. */
  async command(actor:AgentActor,raw:unknown) {
    adminOnly(actor);const data=input(z.object({targetId:salesIdSchema,
      action:z.enum(['suspend_user','restore_user','verify_professional','unverify_professional','flag_job','clear_job']),
      reason:z.string().trim().min(5).max(500).transform(redactSecrets)}).strict(),raw);
    return operationsRepository.moderate(actor.uid,data.targetId,data.action,data.reason);
  }
  /** Junta mercado, producto, economia e IA; null representa evidencia ausente. */
  async center(actor:AgentActor,month?:string):Promise<CommandCenter> {
    adminOnly(actor);
    const snapshot=await intelligenceService.snapshot(actor,month);
    const counts=await operationsRepository.counts();const governance=await governanceService.overview(actor);
    return {snapshot,funnel:{leads:counts.leads,customers:counts.customers,
      conversion:counts.leads?counts.customers/counts.leads:null,
      definition:'Leads CRM marcados CUSTOMER tras verificar un pago / leads CRM. No es conversion de visitas.'},
      operations:{openTickets:counts.openTickets,flaggedJobs:counts.flaggedJobs},
      ai:{observations:governance.metrics.observedCalls,success:governance.metrics.agentSuccess,
        fallback:governance.metrics.fallback,failure:governance.metrics.agentFailure,
        knownEstimatedCostUsd:governance.metrics.knownEstimatedCostUsd,unknownCostCalls:governance.metrics.unknownCostCalls,
        automationRate:null},
      generatedAt:new Date().toISOString(),limitations:[governance.scope,'GMV, cohortes y atribucion requieren instrumentacion adicional.',
        'Revenue es dinero confirmado. MRR/ARR son estimaciones contractuales. No se mezclan monedas.',
        'La tasa de automatizacion requiere definir que acciones se completan sin intervencion humana.']};
  }
}
export const operationsService=new OperationsService();
