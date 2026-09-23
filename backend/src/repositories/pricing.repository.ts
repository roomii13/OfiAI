/** @archivo pricing.repository.ts @descripcion Evidencia propia, leases, versiones y auditoria atomica. */
import { randomUUID } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES as C } from '../database/firestore/collections';
import { ApiError } from '../middleware/error.middleware';
import { PRICING_POLICY as P } from '../constants/pricing';
import { MATCHING_PROFILE_FIELDS } from '../constants/matching';
import { matchingJobFingerprint, matchingCategory, matchingCountry, normalizeMatchText, matchingText } from '../domain/matching/matching';
import { pricingDate } from '../domain/pricing/pricing';
import { rankingTool } from '../ai/tools/ranking.tool';
import { pricingQuoteSchema } from '../validators/pricing.validator';
import { pricingEvent, type PricingEventType } from '../events/pricing.event';
import type { Trabajo } from '../models/Job';
import type { Profesional } from '../models/Professional';
import type { MatchingRun } from '../models/matching.model';
import type { PricingContext, PricingInputs, PricingQuote, PricingSnapshot, PricingEvidence, PricingRun, PricingEstimate, PricingHistoryItem } from '../models/pricing.model';
const emptyContext: PricingContext = { inputs: null, revision: 0, quoteCount: 0 };
/** Mantiene presupuestos privados en subcolecciones accesibles solo por la API. */
export class PricingRepository {
  /** Firestore inyectable para pruebas de transacciones. */
  constructor(private readonly db: Firestore = firestore) {}
  /** Documento padre existente. */
  private job(id: string) { return this.db.collection(C.TRABAJOS).doc(id); }
  /** Metadatos internos de pricing. */
  private meta(id: string, name: string) { return this.job(id).collection(C.PRICING).doc(name); }
  /** Emite metrica dentro del mismo commit del cambio. */
  private event(tx: Transaction, type: PricingEventType, id: string, result?: PricingEstimate, duration = 0): void {
    const ref = this.db.collection(C.ANALYTICS_EVENTOS).doc(); tx.create(ref, { id: ref.id, ...pricingEvent(type, id, result, duration) });
  }
  /** Snapshot consistente de inputs, presupuestos y corrida. */
  async read(id: string): Promise<PricingSnapshot> {
    return this.db.runTransaction(async tx => {
      const context = await tx.get(this.meta(id, 'context')); const run = await tx.get(this.meta(id, 'current'));
      const quotes = await tx.get(this.job(id).collection(C.PRICING_QUOTES).limit(P.maxQuotes));
      return { context: context.exists ? context.data() as PricingContext : emptyContext,
        run: run.exists ? run.data() as PricingRun : null,
        quotes: quotes.docs.map(d => d.data() as PricingQuote).sort((a, b) => a.id.localeCompare(b.id)) };
    });
  }
  /** Mutaciones con revision optimista; no se sobreescribe el presupuesto original del Job. */
  async update(job: Trabajo, revision: number, change: { inputs: PricingInputs } | { quote: PricingQuote }): Promise<void> {
    await this.db.runTransaction(async tx => {
      const ref = this.meta(job.id, 'context'); const stored = await tx.get(ref);
      const currentJob = (await tx.get(this.job(job.id))).data() as Trabajo | undefined;
      const context = stored.exists ? stored.data() as PricingContext : emptyContext;
      const quoteRef = 'quote' in change ? this.job(job.id).collection(C.PRICING_QUOTES).doc(change.quote.id) : null;
      const existing = quoteRef ? await tx.get(quoteRef) : null;
      if (!currentJob || currentJob.empresaId !== job.empresaId || ['cancelado', 'completado'].includes(currentJob.estado)) throw new ApiError('La solicitud ya no permite cambios.', 409);
      if (existing?.exists) {
        const value = existing.data();
        if (JSON.stringify(pricingQuoteSchema.parse(value)) !== JSON.stringify(pricingQuoteSchema.parse('quote' in change ? change.quote : {}))) throw new ApiError('Ese identificador ya corresponde a otro presupuesto.', 409);
        return;
      }
      if (context.revision !== revision) throw new ApiError('Los datos cambiaron. Actualiza antes de guardar.', 409);
      if (quoteRef && context.quoteCount >= P.maxQuotes) throw new ApiError('Se alcanzo el limite de presupuestos del trabajo.', 409);
      tx.set(ref, { inputs: 'inputs' in change ? change.inputs : context.inputs, revision: revision + 1, quoteCount: context.quoteCount + (quoteRef ? 1 : 0) });
      if (quoteRef && 'quote' in change) tx.create(quoteRef, change.quote);
      const audit = this.job(job.id).collection(C.PRICING_AUDIT).doc(randomUUID());
      tx.create(audit, { type: 'inputs' in change ? 'inputs_updated' : 'quote_recorded', revision: revision + 1,
        at: new Date().toISOString(), ...change });
      this.event(tx, 'inputs' in change ? 'pricing_inputs_updated' : 'pricing_quote_recorded', job.id);
    });
  }
  /** Referencias minimas: presupuestos registrados, historicos de la misma empresa y tarifas de candidatos reales. */
  async evidence(job: Trabajo, snapshot: PricingSnapshot): Promise<{ rows: PricingEvidence[]; limited: boolean }> {
    const rows: PricingEvidence[] = snapshot.quotes.map(q => ({ id: 'quote:' + q.id, source: 'quote', amount: q.amount, currency: q.currency,
      scope: q.scope, unit: q.unit, quantity: q.quantity, materials: q.materials, taxes: q.taxes,
      date: '2000-01-01T00:00:00.000Z', expiresAt: q.validUntil + 'T23:59:59.999Z' }));
    // La fecha de alta se conserva por separado; no inferir antiguedad del presupuesto desde su vencimiento.
    const audits = await this.job(job.id).collection(C.PRICING_AUDIT).where('type', '==', 'quote_recorded').limit(P.maxQuotes).get();
    for (const row of rows) {
      const audit = audits.docs.find(d => d.data().quote?.id === row.id.slice(6));
      row.date = pricingDate(audit?.data().at) ?? row.date;
    }
    const proposals = await this.db.collection(C.PROPUESTAS).where('empresaId', '==', job.empresaId)
      .select('trabajoId', 'empresaId', 'precioOfertado', 'moneda', 'estado', 'fechaEnvio', 'pricingTerms').limit(P.maxRecords + 1).get();
    const ids = [...new Set(proposals.docs.slice(0, P.maxRecords).map(d => d.data().trabajoId).filter((id): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id)))];
    const jobs = ids.length ? await this.db.getAll(...ids.map(id => this.job(id)),
      { fieldMask: ['empresaId', 'estado', 'categoria', 'ciudad', 'tipoTrabajo', 'location', 'fechaActualizacion'] }) : [];
    for (const doc of proposals.docs.slice(0, P.maxRecords)) {
      const p = doc.data(); const parent = jobs.find(j => j.id === p.trabajoId)?.data();
      if (!parent || parent.empresaId !== job.empresaId || !['enviada', 'vista', 'aceptada'].includes(p.estado)) continue;
      const history = p.trabajoId !== job.id;
      if (history && (parent.estado !== 'completado' || p.estado !== 'aceptada'
        || matchingCategory(parent.categoria ?? '') !== matchingCategory(job.categoria)
        || normalizeMatchText(parent.ciudad) !== normalizeMatchText(job.ciudad) || parent.tipoTrabajo !== job.tipoTrabajo
        || matchingCountry(parent.location?.country) !== matchingCountry(job.location?.country))) continue;
      const parsed = pricingQuoteSchema.safeParse({ ...p.pricingTerms, id: '00000000-0000-4000-8000-000000000000', label: 'Presupuesto recibido',
        amount: p.precioOfertado, currency: p.moneda });
      const date = pricingDate(p.fechaEnvio);
      if (!parsed.success || !date) continue;
      const q = parsed.data;
      rows.push({ id: 'proposal:' + doc.id, source: history ? 'history' : 'quote', amount: q.amount, currency: q.currency,
        scope: q.scope, unit: q.unit, quantity: q.quantity, materials: q.materials, taxes: q.taxes,
        date, expiresAt: history ? null : q.validUntil + 'T23:59:59.999Z' });
    }
    const input = snapshot.context.inputs;
    const matching = (await this.job(job.id).collection(C.MATCHING).doc('current').get()).data() as MatchingRun | undefined;
    if (input?.unit === 'hour' && input.materials !== 'unknown' && input.taxes !== 'unknown' && matching
      && ['completed', 'fallback'].includes(matching.status) && matching.fingerprint === matchingJobFingerprint(job) && Date.parse(matching.expiresAt ?? '') > Date.now()) {
      const proIds = Object.keys(matching.profileVersions).slice(0, 20);
      const profiles = proIds.length ? await this.db.getAll(...proIds.map(id => this.db.collection(C.PROFESIONALES).doc(id)),
        { fieldMask: [...MATCHING_PROFILE_FIELDS, 'tarifaHoraMateriales', 'tarifaHoraImpuestos', 'tarifaHoraActualizadaAt'] }) : [];
      for (const doc of profiles) {
        if (!doc.exists) continue;
        const pro = { ...doc.data(), id: doc.id } as Profesional;
        if (!rankingTool.evaluarProfesional(job, pro).eligible || typeof pro.tarifaHora !== 'number' || pro.tarifaHora <= 0
          || pro.moneda !== input.currency || (input.requiredExperienceYears !== null && !(pro.aniosExperiencia >= input.requiredExperienceYears))) continue;
        const date = pricingDate(pro.tarifaHoraActualizadaAt);
        if (!date || !pro.tarifaHoraMateriales || !pro.tarifaHoraImpuestos) continue;
        rows.push({ id: 'rate:' + doc.id, source: 'rate', amount: pro.tarifaHora, currency: pro.moneda,
          scope: input.scope, unit: 'hour', quantity: 1, materials: pro.tarifaHoraMateriales, taxes: pro.tarifaHoraImpuestos,
          date, expiresAt: matching.expiresAt });
      }
    }
    return { rows: rows.sort((a, b) => a.id.localeCompare(b.id)), limited: proposals.size > P.maxRecords };
  }
  /** Obtiene versiones recientes, no prompts ni datos internos completos. */
  async history(id: string): Promise<PricingHistoryItem[]> {
    const docs = await this.job(id).collection(C.PRICING_ESTIMATES).orderBy('generatedAt', 'desc').limit(10).get();
    return docs.docs.map(doc => { const r = doc.data().result as PricingEstimate;
      return { id: r.id, generatedAt: r.generatedAt, status: r.status, currency: r.currency, range: r.range, confidence: r.confidence }; });
  }
  /** Lease y revision evitan duplicados y escrituras contra otro Job. */
  async claim(job: Trabajo, snapshot: PricingSnapshot, fingerprint: string): Promise<PricingRun | null> {
    return this.db.runTransaction(async tx => {
      const ref = this.meta(job.id, 'current'); const old = (await tx.get(ref)).data() as PricingRun | undefined;
      const context = (await tx.get(this.meta(job.id, 'context'))).data() as PricingContext | undefined;
      const currentJob = (await tx.get(this.job(job.id))).data() as Trabajo | undefined;
      if (!currentJob || currentJob.empresaId !== job.empresaId || matchingJobFingerprint(currentJob) !== matchingJobFingerprint(job)
        || (context?.revision ?? 0) !== snapshot.context.revision) throw new ApiError('Los datos cambiaron. Actualiza la estimacion.', 409);
      if (old && (old.status === 'processing' && old.leaseUntil > Date.now()
        || old.fingerprint === fingerprint && old.status === 'completed' && Date.parse(old.result?.expiresAt ?? '') > Date.now())) return null;
      const run: PricingRun = { id: randomUUID(), fingerprint, status: 'processing', leaseUntil: Date.now() + P.leaseMs, startedAt: new Date().toISOString(), result: null };
      tx.set(ref, run); this.event(tx, 'pricing_started', job.id); return run;
    });
  }
  /** Publica una version inmutable junto a su evidencia y el evento de finalizacion. */
  async finish(job: Trabajo, snapshot: PricingSnapshot, run: PricingRun, result: PricingEstimate): Promise<void> {
    await this.db.runTransaction(async tx => {
      const ref = this.meta(job.id, 'current'); const current = (await tx.get(ref)).data() as PricingRun | undefined;
      const context = (await tx.get(this.meta(job.id, 'context'))).data() as PricingContext | undefined;
      const currentJob = (await tx.get(this.job(job.id))).data() as Trabajo | undefined;
      if (!currentJob || currentJob.empresaId !== job.empresaId || matchingJobFingerprint(currentJob) !== matchingJobFingerprint(job)
        || current?.id !== run.id || (context?.revision ?? 0) !== snapshot.context.revision) throw new ApiError('Los datos cambiaron durante el analisis. Volve a calcular.', 409);
      tx.set(ref, { ...run, status: 'completed', leaseUntil: 0, result });
      tx.create(this.job(job.id).collection(C.PRICING_ESTIMATES).doc(run.id), { generatedAt: result.generatedAt,
        result, fingerprint: run.fingerprint, inputs: snapshot.context.inputs, revision: snapshot.context.revision,
        jobFingerprint: matchingJobFingerprint(job), job: { category: job.categoria, description: matchingText(job.descripcion, 4000),
          city: job.ciudad ?? null, urgency: job.urgency ?? null, estimatedScope: job.estimatedScope ?? null } });
      this.event(tx, 'pricing_completed', job.id, result, Date.now() - Date.parse(run.startedAt));
      if (result.fallbackUsed) this.event(tx, 'pricing_fallback_used', job.id, result);
    });
  }
  /** Libera exclusivamente la corrida que fallo. */
  async fail(jobId: string, run: PricingRun): Promise<void> {
    await this.db.runTransaction(async tx => {
      const ref = this.meta(jobId, 'current'); const doc = await tx.get(ref);
      if (doc.data()?.id === run.id) { tx.update(ref, { status: 'failed', leaseUntil: 0 }); this.event(tx, 'pricing_failed', jobId); }
    });
  }
}
export const pricingRepository = new PricingRepository();
