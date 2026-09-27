/**
 * @archivo matching.service.ts
 * @descripcion Caso de uso de matching y seleccion, independiente de Intake y del transporte HTTP.
 */
import { createHash } from 'node:crypto';
import { ApiError } from '../middleware/error.middleware';
import { jobsRepository } from '../repositories/jobs.repository';
import { companyRepository } from '../repositories/company.repository';
import { professionalRepository } from '../repositories/professional.repository';
import { matchingRepository } from '../repositories/matching.repository';
import { matchingAgent } from '../ai/agents/matching.agent';
import { rankingTool } from '../ai/tools/ranking.tool';
import { MATCHING_POLICY, MATCHING_WEIGHTS } from '../constants/matching';
import { MATCHING_PROMPT_VERSION, MATCHING_SYSTEM_PROMPT } from '../ai/prompts/matching.prompt';
import { matchingIdSchema } from '../validators/matching.validator';
import { matchingJobFingerprint, matchingProfileFingerprint, publicMatchingJob, publicMatchProfessional } from '../domain/matching/matching';
import { aiProviderCacheConfig, env } from '../config/env';
import { logger } from '../config/logger';
import { metricas } from '../monitoring/metrics';
import { pricingWorker } from '../workers/pricing.worker';
import type { Trabajo } from '../models/Job';
import type { RolUsuario } from '../models/User';
import type { MatchingResult, MatchingRun, MatchingSnapshot, ProfessionalMatch } from '../models/matching.model';

/** Servicio reutilizable desde endpoint o worker interno con identidad de empresa. */
export class MatchingService {
  /** Versiona proveedor, prompt y politica para invalidar caches anteriores. */
  private configVersion(): string {
    return createHash('sha256').update(JSON.stringify({ policy: MATCHING_POLICY, weights: MATCHING_WEIGHTS,
      prompt: MATCHING_SYSTEM_PROMPT, version: MATCHING_PROMPT_VERSION, model: env.GEMINI_MATCHING_MODEL,
      enabled: env.GEMINI_MATCHING_ENABLED, providers: aiProviderCacheConfig(), ttl: env.MATCHING_CACHE_TTL_SECONDS })).digest('hex');
  }
  /** Valida parametros antes de construir rutas Firestore. */
  private id(value: string): void {
    if (!matchingIdSchema.safeParse(value).success) throw new ApiError('Identificador invalido.', 400);
  }
  /** Una empresa solo puede operar sus Jobs; nunca se acepta companyId del cliente. */
  private async owned(jobId: string, userId: string, role: RolUsuario): Promise<Trabajo> {
    this.id(jobId);
    if (role !== 'empresa') throw new ApiError('Esta funcion esta disponible para empresas.', 403);
    const company = await companyRepository.findByUsuarioId(userId);
    const job = await jobsRepository.findById(jobId);
    if (!company || !job || job.empresaId !== company.id) throw new ApiError('No se encontro la solicitud.', 404);
    if (['cancelado', 'completado'].includes(job.estado)) throw new ApiError('Esta solicitud ya esta cerrada.', 409);
    return job;
  }
  /** Comprueba TTL, contenido del Job y cambios en cada candidato guardado. */
  private async valid(job: Trabajo, snapshot: MatchingSnapshot): Promise<boolean> {
    const run = snapshot.run;
    if (!run || !['completed', 'fallback'].includes(run.status) || run.fingerprint !== matchingJobFingerprint(job)
      || run.configVersion !== this.configVersion() || !(Date.parse(run.expiresAt ?? '') > Date.now())
      || Object.keys(run.profileVersions).length !== snapshot.matches.length) return false;
    const professionals = await professionalRepository.findMatchingByIds(snapshot.matches.map(row => row.professionalId));
    return professionals.length === snapshot.matches.length && professionals.every(pro =>
      matchingProfileFingerprint(pro) === run.profileVersions[pro.id] && rankingTool.evaluarProfesional(job, pro).eligible);
  }
  /** Expone solamente el contrato publico, nunca huellas o leases internos. */
  private result(job: Trabajo, snapshot: MatchingSnapshot, valid: boolean): MatchingResult {
    const run = snapshot.run;
    const processing = run?.status === 'processing' && run.leaseUntil > Date.now() && run.fingerprint === matchingJobFingerprint(job);
    const status = valid ? run!.status : processing ? 'processing' : run?.status === 'failed' ? 'failed' : 'pending';
    return { jobId: job.id, job: publicMatchingJob(job), runId: run?.runId ?? null, status,
      completedStages: valid || processing ? run!.completedStages : 0,
      totalCandidates: valid ? run!.totalCandidates : 0, scannedCandidates: valid ? run!.scannedCandidates : 0,
      searchLimited: valid ? run!.searchLimited : false, matches: valid ? snapshot.matches.map(({ runId: _runId, ...match }) => match) : [],
      generatedAt: valid ? run!.generatedAt : null, expiresAt: valid ? run!.expiresAt : null,
      semanticMatchingUsed: valid && run!.semanticMatchingUsed, fallbackUsed: valid && run!.fallbackUsed,
      cached: valid, selectedProfessionalId: valid ? run!.selectedProfessionalId : null,
      message: valid || processing || status === 'failed' ? run!.message : 'La solicitud esta lista para buscar profesionales.' };
  }
  /** Recupera resultados recientes sin ejecutar Gemini; invalida perfiles desactualizados. */
  async get(jobId: string, userId: string, role: RolUsuario): Promise<MatchingResult> {
    const job = await this.owned(jobId, userId, role);
    const snapshot = await matchingRepository.read(jobId);
    return this.result(job, snapshot, await this.valid(job, snapshot));
  }
  /** Filtra, puntua, enriquece opcionalmente y persiste una corrida idempotente por lease. */
  async execute(jobId: string, userId: string, role: RolUsuario): Promise<MatchingResult> {
    const job = await this.owned(jobId, userId, role);
    if (!job.categoria?.trim() || !job.descripcion?.trim() || (job.tipoTrabajo !== 'remoto' && !job.ciudad?.trim() && !job.location?.city)) {
      throw new ApiError('Completa categoria, descripcion y ubicacion de la solicitud antes de buscar.', 400);
    }
    const before = await matchingRepository.read(jobId);
    if (await this.valid(job, before)) return this.result(job, before, true);
    const claimed = await matchingRepository.claim(job, this.configVersion(), before.run?.runId ?? null);
    if (!claimed.acquired) return this.get(jobId, userId, role);
    const run = claimed.run; const started = Date.now();
    try {
      const pool = await professionalRepository.findMatchingCandidates();
      await matchingRepository.progress(run, 2);
      const candidates = rankingTool.rankearProfesionales(job, pool.professionals, pool.professionals.length)
        .filter(candidate => candidate.eligible);
      const finalists = candidates.slice(0, MATCHING_POLICY.maxSemanticCandidates);
      await matchingRepository.progress(run, 4);
      const semantic = await matchingAgent.analyze(job, finalists);
      const generatedAt = new Date().toISOString();
      const matches: ProfessionalMatch[] = finalists.map<ProfessionalMatch>(candidate => {
        const explanation = semantic.matches.find(row => row.professionalId === candidate.profesional.id);
        const profile = publicMatchProfessional(candidate.profesional);
        const score = Math.round((explanation ? candidate.puntaje * (1 - MATCHING_POLICY.semanticWeight) + explanation.semanticScore * MATCHING_POLICY.semanticWeight : candidate.puntaje) * 100) / 100;
        return { professionalId: profile.id, professional: profile, matchScore: score, deterministicScore: candidate.puntaje,
          semanticScore: explanation?.semanticScore ?? null, distanceKm: candidate.distanceKm,
          reason: explanation?.reason ?? candidate.razones.join(' '),
          strengths: [...new Set([...candidate.razones, ...(explanation?.strengths ?? [])])].slice(0, 10),
          concerns: [...new Set([...candidate.alertas, ...(explanation?.concerns ?? [])])].slice(0, 12),
          recommended: score >= MATCHING_POLICY.recommendedThreshold && candidate.puntaje >= 50 && profile.available !== false && explanation?.recommended !== false,
          state: 'recommended', generatedAt };
      }).sort((a, b) => b.matchScore - a.matchScore || a.professionalId.localeCompare(b.professionalId));
      const finished: MatchingRun = { ...run, status: semantic.fallback ? 'fallback' : 'completed', completedStages: 5,
        averageMatchScore: matches.length ? Math.round(matches.reduce((sum, row) => sum + row.matchScore, 0) / matches.length * 100) / 100 : 0,
        totalCandidates: candidates.length, scannedCandidates: pool.scanned, searchLimited: pool.limited,
        generatedAt, expiresAt: new Date(Date.now() + env.MATCHING_CACHE_TTL_SECONDS * 1000).toISOString(), leaseUntil: 0,
        semanticMatchingUsed: semantic.used, fallbackUsed: semantic.fallback,
        profileVersions: Object.fromEntries(finalists.map(candidate => [candidate.profesional.id, matchingProfileFingerprint(candidate.profesional)])),
        message: matches.length === 0 ? 'Todavia no encontramos profesionales que cumplan todos los requisitos. Podemos ampliar la busqueda.'
          : semantic.used ? 'OfiAI analizo tu solicitud y encontro profesionales compatibles.'
          : 'Recomendaciones generadas con criterios de compatibilidad.' };
      await matchingRepository.finish(job, finished, matches);
      await pricingWorker(job.id, false).catch(() => logger.warn('Pricing pendiente; matching conservado.', { jobId: job.id }));
      metricas.observarLatencia('matching_duration', Date.now() - started);
      metricas.incrementarContador(semantic.fallback ? 'matching_fallback_used' : 'matching_completed');
      const result = await this.get(jobId, userId, role);
      return { ...result, cached: false };
    } catch (error) {
      await matchingRepository.fail(run).catch(() => logger.warn('No se pudo actualizar el estado de matching fallido.'));
      metricas.incrementarContador('matching_failed');
      if (error instanceof ApiError) throw error;
      logger.warn('No se pudo completar el matching.', { jobId, runId: run.runId });
      throw new ApiError('No pudimos completar la busqueda. Tu solicitud sigue guardada.', 503);
    }
  }
  /** Perfil publico contextual; no permite consultar IDs fuera de la corrida vigente. */
  async profile(jobId: string, professionalId: string, userId: string, role: RolUsuario): Promise<ProfessionalMatch> {
    this.id(professionalId);
    const job = await this.owned(jobId, userId, role); const snapshot = await matchingRepository.read(jobId);
    if (!await this.valid(job, snapshot)) throw new ApiError('Actualiza las recomendaciones antes de ver este perfil.', 409);
    const match = snapshot.matches.find(row => row.professionalId === professionalId);
    if (!match) throw new ApiError('No se encontro el candidato.', 404);
    await matchingRepository.viewed('professional_profile_viewed', snapshot.run!, snapshot.matches.map(row => row.matchScore), professionalId);
    const { runId: _runId, ...visible } = match; return visible;
  }
  /** Guarda selected como preparacion de Pricing/Coordinator, sin contratar. */
  async select(jobId: string, professionalId: string, runId: string, userId: string, role: RolUsuario): Promise<MatchingResult> {
    this.id(professionalId);
    const job = await this.owned(jobId, userId, role);
    const snapshot = await matchingRepository.read(jobId);
    if (!await this.valid(job, snapshot) || snapshot.run?.runId !== runId) {
      throw new ApiError('Actualiza las recomendaciones antes de seleccionar.', 409);
    }
    await matchingRepository.select(job, runId, professionalId);
    return this.get(jobId, userId, role);
  }
  /** Registra una vista explicita y autenticada, no cada consulta de progreso. */
  async viewed(jobId: string, runId: string, userId: string, role: RolUsuario): Promise<void> {
    const job = await this.owned(jobId, userId, role); const snapshot = await matchingRepository.read(jobId);
    if (!await this.valid(job, snapshot) || snapshot.run?.runId !== runId) throw new ApiError('Actualiza las recomendaciones.', 409);
    await matchingRepository.viewed('match_viewed', snapshot.run, snapshot.matches.map(row => row.matchScore));
  }
}
export const matchingService = new MatchingService();
