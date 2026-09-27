/**
 * @archivo matching.repository.ts
 * @descripcion Corridas, leases, resultados y seleccion atomica sobre el Job existente.
 */
import { randomUUID } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES as C } from '../database/firestore/collections';
import { MATCHING_POLICY } from '../constants/matching';
import { ApiError } from '../middleware/error.middleware';
import { matchingJobFingerprint, matchingProfileFingerprint, isMatchingActive } from '../domain/matching/matching';
import { matchingEvent, type MatchingEventType } from '../events/matching.event';
import type { MatchingRun, MatchingSnapshot, ProfessionalMatch, StoredMatch } from '../models/matching.model';
import type { Trabajo } from '../models/Job';
import type { Profesional } from '../models/Professional';
/** Persistencia sin llamadas al proveedor dentro de una transaccion. */
export class MatchingRepository {
  /** Permite probar el contrato con un adaptador Firestore aislado. */
  constructor(private readonly db: Firestore = firestore) {}
  /** Referencia al Job padre. */
  private job(id: string) { return this.db.collection(C.TRABAJOS).doc(id); }
  /** Una corrida vigente por Job, preparada para un worker futuro. */
  private current(id: string) { return this.job(id).collection(C.MATCHING).doc('current'); }
  /** Resultados limitados bajo el Job propietario. */
  private candidates(id: string) { return this.job(id).collection(C.MATCHES); }
  /** Evento en la misma transaccion cuando corresponde. */
  private event(tx: Transaction, type: MatchingEventType, run: MatchingRun, scores: number[] = [], professionalId?: string): void {
    const ref = this.db.collection(C.ANALYTICS_EVENTOS).doc();
    tx.create(ref, { id: ref.id, ...matchingEvent(type, run, scores, professionalId) });
  }
  /** Lee meta y resultados atomicos; no devuelve corridas mezcladas. */
  async read(jobId: string): Promise<MatchingSnapshot> {
    return this.db.runTransaction(async tx => {
      const meta = await tx.get(this.current(jobId));
      if (!meta.exists) return { run: null, matches: [] };
      const run = meta.data() as MatchingRun;
      const rows = await tx.get(this.candidates(jobId));
      return { run, matches: rows.docs.map(doc => doc.data() as StoredMatch).filter(row => row.runId === run.runId).sort((a, b) => b.matchScore - a.matchScore || a.professionalId.localeCompare(b.professionalId)) };
    });
  }
  /** Reclama una corrida con lease; evita llamadas Gemini simultaneas sobre el mismo Job. */
  async claim(job: Trabajo, configVersion: string, observedRunId: string | null): Promise<{ acquired: boolean; run: MatchingRun }> {
    return this.db.runTransaction(async tx => {
      const ref = this.current(job.id);
      const snapshot = await tx.get(ref);
      const jobDoc = await tx.get(this.job(job.id));
      const currentJob = jobDoc.data() as Trabajo | undefined;
      if (currentJob?.coordinationState && currentJob.coordinationState !== 'CANCELLED') throw new ApiError('Ya existe una coordinacion. Conserva la seleccion acordada.', 409);
      const fingerprint = matchingJobFingerprint(job);
      if (!currentJob || currentJob.empresaId !== job.empresaId || matchingJobFingerprint(currentJob) !== fingerprint) throw new ApiError('La solicitud cambio. Actualiza la pantalla.', 409);
      const old = snapshot.exists ? snapshot.data() as MatchingRun : null;
      if (old && ((old.status === 'processing' && old.leaseUntil > Date.now())
        || (old.runId !== observedRunId && old.fingerprint === fingerprint && old.configVersion === configVersion && ['completed', 'fallback'].includes(old.status) && Date.parse(old.expiresAt ?? '') > Date.now()))) return { acquired: false, run: old };
      const run: MatchingRun = {
        jobId: job.id, companyId: job.empresaId, runId: randomUUID(), status: 'processing', fingerprint, configVersion,
        completedStages: 1, totalCandidates: 0, scannedCandidates: 0, searchLimited: false,
        generatedAt: null, expiresAt: null, semanticMatchingUsed: false, fallbackUsed: false,
        selectedProfessionalId: null, message: 'OfiAI esta buscando profesionales...', leaseUntil: Date.now() + MATCHING_POLICY.leaseMs,
        profileVersions: {}, startedAt: new Date().toISOString(), averageMatchScore: 0,
      };
      tx.set(ref, run);
      tx.update(this.job(job.id), { matchingStatus: 'processing' });
      this.event(tx, 'matching_started', run);
      return { acquired: true, run };
    });
  }
  /** Persiste etapas reales para las pantallas que consultan progreso. */
  async progress(run: MatchingRun, completedStages: number): Promise<void> {
    await this.db.runTransaction(async tx => {
      const ref = this.current(run.jobId); const doc = await tx.get(ref);
      if (doc.data()?.runId === run.runId) tx.update(ref, { completedStages });
    });
  }
  /** Reemplaza una corrida completa y sus resultados en un solo commit. */
  async finish(job: Trabajo, run: MatchingRun, matches: ProfessionalMatch[]): Promise<void> {
    await this.db.runTransaction(async tx => {
      const current = await tx.get(this.current(job.id));
      const storedJob = (await tx.get(this.job(job.id))).data() as Trabajo | undefined;
      const previous = await tx.get(this.candidates(job.id));
      if (current.data()?.runId !== run.runId || !storedJob || matchingJobFingerprint(storedJob) !== run.fingerprint) throw new ApiError('La solicitud cambio durante el analisis. Intenta nuevamente.', 409);
      const selection = storedJob.matchingSelection;
      const selected = selection?.jobFingerprint === run.fingerprint && matches.some(row => row.professionalId === selection.professionalId) ? selection : null;
      run.selectedProfessionalId = selected?.professionalId ?? null;
      for (const doc of previous.docs) tx.delete(doc.ref);
      for (const match of matches) tx.set(this.candidates(job.id).doc(match.professionalId), { ...match, state: selected?.professionalId === match.professionalId ? 'selected' : 'recommended', runId: run.runId });
      tx.set(this.current(job.id), run);
      tx.update(this.job(job.id), { matchingStatus: run.status,
        matchingSelection: selected ? { ...selected, runId: run.runId } : null,
        profesionalesRecomendados: matches.map(row => row.professionalId), puntajeMatchingIA: matches[0]?.matchScore ?? 0 });
      this.event(tx, 'matching_completed', run, matches.map(row => row.matchScore));
      if (run.fallbackUsed) this.event(tx, 'matching_fallback_used', run, matches.map(row => row.matchScore));
    });
  }
  /** Libera una corrida fallida sin borrar el Job ni revelar la causa interna. */
  async fail(run: MatchingRun): Promise<void> {
    await this.db.runTransaction(async tx => {
      const ref = this.current(run.jobId); const doc = await tx.get(ref);
      if (doc.data()?.runId !== run.runId) return;
      const failed: MatchingRun = { ...run, status: 'failed', leaseUntil: 0, message: 'No pudimos completar la busqueda. Podes reintentar.' };
      tx.set(ref, failed); tx.update(this.job(run.jobId), { matchingStatus: 'failed' });
      this.event(tx, 'matching_failed', failed);
    });
  }
  /** Selecciona sin asignar, contratar, notificar ni modificar el estado comercial del trabajo. */
  async select(job: Trabajo, runId: string, professionalId: string): Promise<void> {
    await this.db.runTransaction(async tx => {
      const meta = await tx.get(this.current(job.id));
      const storedJob = (await tx.get(this.job(job.id))).data() as Trabajo | undefined;
      const matchRef = this.candidates(job.id).doc(professionalId);
      const match = await tx.get(matchRef);
      const professionalDoc = await tx.get(this.db.collection(C.PROFESIONALES).doc(professionalId));
      const professional = professionalDoc.exists ? { ...professionalDoc.data(), id: professionalDoc.id } as Profesional : null;
      if (storedJob?.coordinationState && storedJob.coordinationState !== 'CANCELLED') throw new ApiError('No se puede cambiar el profesional durante una coordinacion.', 409);
      const run = meta.data() as MatchingRun | undefined;
      if (!run || run.runId !== runId || !['completed', 'fallback'].includes(run.status) || !(Date.parse(run.expiresAt ?? '') > Date.now())
        || !storedJob || storedJob.empresaId !== job.empresaId || run.fingerprint !== matchingJobFingerprint(storedJob)
        || !match.exists || match.data()?.runId !== runId || !professional || !isMatchingActive(professional)
        || matchingProfileFingerprint(professional) !== run.profileVersions[professionalId]) throw new ApiError('La recomendacion cambio. Actualiza los resultados antes de seleccionar.', 409);
      if (run.selectedProfessionalId === professionalId) return;
      if (run.selectedProfessionalId) tx.update(this.candidates(job.id).doc(run.selectedProfessionalId), { state: 'recommended' });
      tx.update(matchRef, { state: 'selected' });
      tx.update(this.current(job.id), { selectedProfessionalId: professionalId });
      tx.update(this.job(job.id), { matchingSelection: { status: 'selected', professionalId, runId, jobFingerprint: run.fingerprint, selectedAt: new Date().toISOString() } });
      this.event(tx, 'professional_selected', run, [Number(match.data()?.matchScore ?? 0)], professionalId);
    });
  }
  /** Guarda una vista por corrida/perfil sin duplicarla por polling o renders de React. */
  async viewed(type: 'match_viewed' | 'professional_profile_viewed', run: MatchingRun, scores: number[], professionalId?: string): Promise<void> {
    const ref = this.db.collection(C.ANALYTICS_EVENTOS).doc(run.runId + '_' + type + '_' + (professionalId ?? 'all'));
    await this.db.runTransaction(async tx => {
      const existing = await tx.get(ref);
      if (!existing.exists) tx.create(ref, { id: ref.id, ...matchingEvent(type, run, scores, professionalId) });
    });
  }
}
export const matchingRepository = new MatchingRepository();
