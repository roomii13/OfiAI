/** @archivo protected-contract.d.ts @descripcion Contratos publicos, independientes de los estados de coordinacion. */
export type FinancialState = 'UNPAID' | 'PAYMENT_PENDING' | 'PAID' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'CHARGEBACK';
export type DisputeState = 'OPEN' | 'UNDER_REVIEW' | 'PROPOSED' | 'RESOLVED' | 'APPEALED';
export type ResolutionKind = 'FULL_PAYMENT' | 'CORRECTION' | 'PARTIAL_REFUND' | 'FULL_REFUND' | 'MORE_INFORMATION' | 'ESCALATE';
/** Tasas en puntos basicos; nunca una tarifa atribuida al proveedor sin validacion. */
export interface ContractPolicy {
  version: string; currency: string; minorDigits: number; commissionBps: number;
  categoryBps: Record<string, number>; processorBps: number; processorFixedMinor: number;
  processorTaxBps: number; platformTaxBps: number; withholdingBps: number;
  providerChargesVerified: boolean; termsVersion: string; dualApprovalMinor: number;
}
/** Totales del servidor, todos en unidades monetarias minimas. */
export interface ContractBreakdown {
  policyVersion: string; termsVersion: string; currency: string; minorDigits: number;
  professionalMinor: number; commissionBps: number; commissionMinor: number;
  processingMinor: number; taxMinor: number; withholdingMinor: number;
  clientTotalMinor: number; platformNetEstimatedMinor: number;
  professionalNetEstimatedMinor: number; professionalNetConfirmedMinor: number | null;
  chargesVerified: boolean;
}
/** Propuesta humana, no orden directa al proveedor ni decision de IA. */
export interface DisputeResolution {
  id: string; kind: ResolutionKind; reason: string; refundMinor: number;
  proposedAt: string; approved: boolean; approvalCount: number;
}
/** Estado seguro visible para los participantes. */
export interface ProtectedContractView {
  id: string; revision: number; workflowId: string; quoteId: string;
  workState: string; financialState: FinancialState; breakdown: ContractBreakdown;
  acceptedAt: string | null; professionalCompletedAt: string | null; clientApprovedAt: string | null;
  collectionEnabled: boolean;
  dispute: null | { id: string; state: DisputeState; reason: string; priority: 'normal' | 'high'; openedAt: string; resolution: DisputeResolution | null };
  refundedMinor: number; updatedAt: string;
}
/** Solo texto y referencias internas; no URLs publicas de documentos sensibles. */
export interface ContractEntry { id: string; kind: 'message' | 'evidence' | 'appeal'; actorRole: string; text: string; at: string; evidenceId?: string }
/** Sugerencia sin capacidades financieras. */
export interface DisputeAdvice { generatedBy: 'ai' | 'rules'; requiresHumanReview: true; summary: string; questions: string[]; alternatives: string[]; evidenceIds: string[] }
