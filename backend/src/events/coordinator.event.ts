/** @archivo coordinator.event.ts @descripcion Metricas operativas y entrega futura a Reputation, sin textos ni importes privados. */
import type { CoordinatorWorkflow } from '../../../shared/coordinator';
/** Evento atomico y deduplicado por revision del workflow. */
export function coordinatorEvent(w: CoordinatorWorkflow, action: string) {
  return { tipo: w.state === 'COMPLETED' ? 'coordination_completed' : 'coordination_' + action,
    entidadId: w.jobId, entidadTipo: 'coordinator', fechaCreacion: new Date(),
    metadata: { workflowId: w.id, revision: w.revision, state: w.state,
      durationMs: Date.parse(w.updatedAt) - Date.parse(w.createdAt), pricingInsufficient: w.pricingInsufficient } };
}
