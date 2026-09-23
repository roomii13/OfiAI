/** @archivo pricing.service.ts @descripcion Casos de uso de Pricing; autorizacion, evidencia, cache y agente. */
import { jobsRepository } from '../repositories/jobs.repository';
import { companyRepository } from '../repositories/company.repository';
import { pricingRepository } from '../repositories/pricing.repository';
import { pricingAgent } from '../ai/agents/pricing.agent';
import { calculatePricing, comparable } from '../ai/tools/pricing.tool';
import { pricingFingerprint } from '../domain/pricing/pricing';
import { matchingText, publicMatchingJob } from '../domain/matching/matching';
import { matchingIdSchema } from '../validators/matching.validator';
import { pricingInputCommand, pricingQuoteCommand } from '../validators/pricing.validator';
import { ApiError } from '../middleware/error.middleware';
import { logger } from '../config/logger';
import type { RolUsuario } from '../models/User';
import type { Trabajo } from '../models/Job';
import type { PricingView, PricingSnapshot, PricingEvidence } from '../models/pricing.model';
/** Servicio compartido por HTTP y worker; las claves permanecen en backend. */
export class PricingService {
  /** Valida tenant antes de consultar referencias o presupuestos. */
  private async owned(id: string, uid: string, role: RolUsuario): Promise<Trabajo> {
    if (role !== 'empresa') throw new ApiError('Pricing esta disponible para empresas.', 403);
    if (!matchingIdSchema.safeParse(id).success) throw new ApiError('Identificador invalido.', 400);
    const company = await companyRepository.findByUsuarioId(uid);
    const job = await jobsRepository.findById(id);
    if (!company || !job || job.empresaId !== company.id) throw new ApiError('No se encontro la solicitud.', 404);
    return job;
  }
  /** No modifica solicitudes canceladas o completadas. */
  private mutable(job: Trabajo): void {
    if (['cancelado', 'completado'].includes(job.estado)) throw new ApiError('Esta solicitud ya esta cerrada.', 409);
  }
  /** TTL y huellas incluyen todo dato que alimenta el calculo. */
  private valid(job: Trabajo, snapshot: PricingSnapshot, rows: PricingEvidence[]): boolean {
    return snapshot.run?.status === 'completed' && snapshot.run.fingerprint === pricingFingerprint(job, snapshot, rows)
      && Date.parse(snapshot.run.result?.expiresAt ?? '') > Date.now()
      && snapshot.run.result!.evidence.every(e => snapshot.context.inputs && comparable(e, snapshot.context.inputs, Date.now()));
  }
  /** Proyeccion publica; no entrega leases, huellas ni auditorias internas. */
  private async view(job: Trabajo, snapshot: PricingSnapshot, rows: PricingEvidence[]): Promise<PricingView> {
    const valid = this.valid(job, snapshot, rows);
    return { jobId: job.id, job: publicMatchingJob(job), inputs: snapshot.context.inputs, revision: snapshot.context.revision,
      quotes: snapshot.quotes, result: valid ? snapshot.run!.result : null, stale: !valid,
      processing: snapshot.run?.status === 'processing' && snapshot.run.leaseUntil > Date.now(),
      history: await pricingRepository.history(job.id),
      nextStep: !valid || !snapshot.run?.result?.range ? 'pricing_required' : job.matchingSelection ? 'coordinator_pending' : 'professional_selection' };
  }
  /** Lee sin invocar Gemini y detecta referencias cambiadas. */
  async get(id: string, uid: string, role: RolUsuario): Promise<PricingView> {
    const job = await this.owned(id, uid, role); const snapshot = await pricingRepository.read(id);
    const evidence = await pricingRepository.evidence(job, snapshot);
    return this.view(job, snapshot, evidence.rows);
  }
  /** Confirma inputs de la empresa, sin transformar estimaciones en presupuestos del Job. */
  async inputs(id: string, uid: string, role: RolUsuario, body: unknown): Promise<PricingView> {
    const job = await this.owned(id, uid, role); this.mutable(job);
    const parsed = pricingInputCommand.safeParse(body);
    if (!parsed.success) throw new ApiError('Revisa alcance, cantidad y cobertura de costos.', 400);
    const inputs = { ...parsed.data.inputs, scope: matchingText(parsed.data.inputs.scope, 400) };
    if (inputs.scope.length < 8) throw new ApiError('Describe un alcance sin datos de contacto.', 400);
    await pricingRepository.update(job, parsed.data.revision, { inputs });
    return this.get(id, uid, role);
  }
  /** Registra evidencia declarada, no simula una oferta emitida por el profesional. */
  async quote(id: string, uid: string, role: RolUsuario, body: unknown): Promise<PricingView> {
    const job = await this.owned(id, uid, role); this.mutable(job);
    const parsed = pricingQuoteCommand.safeParse(body);
    if (!parsed.success) throw new ApiError('Revisa importe, moneda, alcance y vencimiento del presupuesto.', 400);
    const quote = { ...parsed.data.quote, label: matchingText(parsed.data.quote.label, 100), scope: matchingText(parsed.data.quote.scope, 400) };
    if (Date.parse(quote.validUntil + 'T23:59:59.999Z') < Date.now() || Date.parse(quote.validUntil) > Date.now() + 366 * 86400000) throw new ApiError('El vencimiento debe estar entre hoy y un ano.', 400);
    await pricingRepository.update(job, parsed.data.revision, { quote });
    return this.get(id, uid, role);
  }
  /** Ejecuta determinismo y analisis opcional; invalida si cambian referencias durante Gemini. */
  async execute(id: string, uid: string, role: RolUsuario): Promise<PricingView> {
    const job = await this.owned(id, uid, role); this.mutable(job);
    const snapshot = await pricingRepository.read(id); const evidence = await pricingRepository.evidence(job, snapshot);
    if (this.valid(job, snapshot, evidence.rows)) return this.view(job, snapshot, evidence.rows);
    const fingerprint = pricingFingerprint(job, snapshot, evidence.rows);
    const run = await pricingRepository.claim(job, snapshot, fingerprint);
    if (!run) return this.get(id, uid, role);
    try {
      const initial = calculatePricing(job, snapshot.context.inputs, evidence.rows, snapshot.quotes, run.id);
      if (evidence.limited) initial.warnings.push('Se revisaron hasta 100 presupuestos propios. El historico puede estar incompleto.');
      const result = await pricingAgent.analyze(job, snapshot.context.inputs, initial);
      const latest = await pricingRepository.read(id);
      const updatedEvidence = await pricingRepository.evidence(job, latest);
      if (pricingFingerprint(job, latest, updatedEvidence.rows) !== fingerprint) throw new ApiError('Las referencias cambiaron. Volve a calcular.', 409);
      await pricingRepository.finish(job, snapshot, run, result);
      return this.get(id, uid, role);
    } catch (error) {
      await pricingRepository.fail(id, run).catch(() => logger.warn('No se pudo liberar la corrida de pricing.'));
      if (error instanceof ApiError) throw error;
      logger.warn('Pricing no disponible.', { jobId: id, runId: run.id });
      throw new ApiError('No pudimos completar la estimacion. Tus datos siguen guardados.', 503);
    }
  }
}
export const pricingService = new PricingService();
