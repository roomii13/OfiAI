/** @archivo coordinator.model.ts @descripcion Modelos del workflow y contratos de integracion entre agentes. */
import type { CoordinatorState, CoordinatorWorkflow } from '../../../shared/coordinator';
export type * from '../../../shared/coordinator';
/** Referencias privadas para autorizacion e invariantes de Job. */
export interface StoredCoordinator extends CoordinatorWorkflow {
  companyUid: string; professionalUid: string; jobFingerprint: string; startKey: string;
  jobSnapshot: import('../../../shared/matching').MatchingJob;
}
/** Referencias a evidencia inmutable que Coordinator debera revalidar antes de cada accion. */
export interface CoordinatorHandoff {
  jobId: string; companyId: string; matchingRunId: string; pricingEstimateId: string;
  professionalId: string; state: 'PROFESSIONAL_SELECTED'; requiresCompanyConfirmation: true;
}
/** Accion auditable e idempotente, todavia sin transporte ni efectos externos. */
export interface CoordinatorDecision {
  workflowId: string; expectedRevision: number; from: CoordinatorState; to: CoordinatorState;
  idempotencyKey: string; reason: string; requiresHumanApproval: boolean;
}
