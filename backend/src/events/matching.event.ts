/**
 * @archivo matching.event.ts
 * @descripcion Eventos agregables sin nombres, conversaciones ni contactos.
 */
import type { MatchingRun } from '../models/matching.model';
export type MatchingEventType = 'matching_started' | 'matching_completed' | 'matching_failed' | 'matching_fallback_used' | 'match_viewed' | 'professional_profile_viewed' | 'professional_selected';
/** Produce un evento minimo con unidades de duracion explicitas en milisegundos. */
export function matchingEvent(type: MatchingEventType, run: MatchingRun, scores: number[] = [], professionalId?: string) {
  return { tipo: type, entidadId: run.jobId, entidadTipo: 'job', fechaCreacion: new Date(), metadata: {
    runId: run.runId, matching_duration: Math.max(0, (run.generatedAt ? Date.parse(run.generatedAt) : Date.now()) - Date.parse(run.startedAt)),
    candidates_found: run.totalCandidates, matches_returned: Object.keys(run.profileVersions).length,
    average_match_score: run.averageMatchScore ?? (scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length * 100) / 100 : 0),
    semantic_matching_used: run.semanticMatchingUsed, fallback_used: run.fallbackUsed,
    professional_selected: type === 'professional_selected', ...(professionalId ? { professionalId } : {}),
  } };
}
