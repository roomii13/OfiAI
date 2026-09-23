/**
 * @archivo matching.model.ts
 * @descripcion Estado interno de corridas y conversion al contrato publico compartido.
 */
import type { MatchingResult, ProfessionalMatch } from '../../../shared/matching';
export type { MatchingResult, ProfessionalMatch, MatchProfessional, MatchingSelection } from '../../../shared/matching';
/** Solo el backend conoce huellas y leases; no contienen prompts ni secretos. */
export interface MatchingRun extends Omit<MatchingResult, 'job' | 'matches' | 'cached'> {
  companyId: string; fingerprint: string; configVersion: string; leaseUntil: number;
  profileVersions: Record<string, string>; startedAt: string; averageMatchScore: number;
}
/** Documento de candidato perteneciente a una corrida concreta. */
export interface StoredMatch extends ProfessionalMatch { runId: string }
/** Snapshot consistente de estado y candidatos. */
export interface MatchingSnapshot { run: MatchingRun | null; matches: StoredMatch[] }
