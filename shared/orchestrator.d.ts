/** @archivo orchestrator.d.ts @descripcion Ejecuciones trazables del orquestador. */
export type BusinessEvent = 'job.created' | 'job.review' | 'business.review' | 'sales.review';
export interface AgentStep {
  agent: string; tool: string; status: 'completed' | 'failed' | 'fallback'; durationMs: number;
  attempts: number; sourceIds: string[]; decision: string;
}
export interface AgentRun {
  id: string; ownerId: string; event: BusinessEvent; resourceId: string | null;
  status: 'processing' | 'completed' | 'failed' | 'fallback' | 'waiting_human';
  steps: AgentStep[]; message: string; createdAt: string; updatedAt: string; leaseUntil: number;
  durationMs: number; version: number; result: Record<string,unknown> | null;
}
