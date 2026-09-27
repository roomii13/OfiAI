/** @archivo coordinator-fixtures.ts @descripcion Estados sinteticos exclusivos de pruebas sin credenciales. */
import { randomUUID } from 'node:crypto';
import { publicMatchingJob, matchingJobFingerprint } from '../src/domain/matching/matching';
import type { StoredCoordinator, CoordinatorCommand } from '../src/models/coordinator.model';
import { matchingJob } from './matching-fixtures';

export const COORDINATOR_NOW = Date.parse('2026-09-23T12:00:00.000Z');
export const COMPANY_UID = 'company-a';
export const PROFESSIONAL_UID = 'professional-a';

/** Workflow completo con identidad privada separada de la vista publica. */
export function coordinatorWorkflow(overrides: Partial<StoredCoordinator> = {}): StoredCoordinator {
  const job = matchingJob();
  return {
    id: '00000000-0000-4000-8000-000000000100', jobId: job.id, companyId: job.empresaId,
    professionalId: 'pro-electrician', professionalName: 'Perfil De prueba',
    companyUid: COMPANY_UID, professionalUid: PROFESSIONAL_UID,
    state: 'PROFESSIONAL_SELECTED', revision: 1, matchingRunId: 'matching-run',
    pricingEstimateId: 'pricing-estimate', pricingInsufficient: true,
    offer: null, schedule: null, completionRequested: false,
    createdAt: new Date(COORDINATOR_NOW).toISOString(), updatedAt: new Date(COORDINATOR_NOW).toISOString(),
    jobFingerprint: matchingJobFingerprint(job), jobSnapshot: publicMatchingJob(job),
    startKey: '00000000-0000-4000-8000-000000000101', ...overrides,
  };
}

/** Comando ligado al workflow y a su revision esperada. */
export function coordinatorCommand(w: Pick<StoredCoordinator, 'id' | 'revision'>,
  action: CoordinatorCommand['action'], overrides: Partial<CoordinatorCommand> = {}): CoordinatorCommand {
  return { workflowId: w.id, revision: w.revision, idempotencyKey: randomUUID(), action, ...overrides };
}
