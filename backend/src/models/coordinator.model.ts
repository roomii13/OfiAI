/** @archivo coordinator.model.ts @descripcion Contrato para la siguiente fase; no ejecuta contacto ni contratacion. */
export type CoordinatorState = 'MATCHED' | 'PROFESSIONAL_SELECTED' | 'CONTACT_PENDING' | 'CONTACTED'
  | 'PROFESSIONAL_RESPONDED' | 'QUOTE_REQUESTED' | 'QUOTE_RECEIVED' | 'COMPANY_REVIEW' | 'NEGOTIATION'
  | 'SCHEDULE_PENDING' | 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED';
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
