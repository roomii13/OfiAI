/** @archivo coordinator.repository.ts @descripcion Workflow transaccional, auditoria, consentimiento y efectos internos idempotentes. */
import { createHash, randomUUID } from 'node:crypto';
import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { firestore } from '../integrations/firebase/admin';
import { SubscriptionRepository } from './subscription.repository';
import { COLECCIONES as C } from '../database/firestore/collections';
import { ApiError } from '../middleware/error.middleware';
import { matchingJobFingerprint, matchingProfileFingerprint, isMatchingActive, matchingText, publicMatchingJob } from '../domain/matching/matching';
import type { MatchingSelection } from '../../../shared/matching';
import { transitionCoordinator } from '../ai/tools/coordinator.tool';
import { COORDINATOR_PROMPT_VERSION } from '../ai/prompts/coordinator.prompt';
import { coordinatorEvent } from '../events/coordinator.event';
import { contractCharges } from '../utils/billing';
import { PROTECTED_COLLECTIONS } from '../constants/protected-payments';
import type { StoredProtectedContract } from '../models/protected-contract.model';
import { transitionProtectedWork } from '../domain/jobs/protected-contract';
import { ProtectedContractRepository } from './protected-contract.repository';
import type { Trabajo } from '../models/Job';
import type { Empresa } from '../models/Company';
import type { Profesional } from '../models/Professional';
import type { MatchingRun } from '../models/matching.model';
import type { PricingRun } from '../models/pricing.model';
import type { StoredCoordinator, CoordinatorCommand, CoordinatorRole, CoordinatorHistory, CoordinatorList, CoordinatorStart } from '../models/coordinator.model';

/** Repositorio inyectable. Ninguna llamada de red a proveedores ocurre dentro de una transaccion. */
export class CoordinatorRepository {
  /** Firestore real o adaptador aislado para pruebas. */
  constructor(private readonly db: Firestore = firestore) {}
  /** Referencia al Job existente. */
  private job(id: string) { return this.db.collection(C.TRABAJOS).doc(id); }
  /** Un workflow vigente por Job; las versiones anteriores permanecen auditadas. */
  private current(id: string) { return this.job(id).collection(C.COORDINATOR).doc('current'); }
  /** Clave determinista por revision para efectos exactamente una vez dentro de Firestore. */
  private eventId(w: StoredCoordinator) { return w.id + '_' + String(w.revision).padStart(6, '0'); }
  /** Verifica los participantes reales en cada transaccion, incluso si cambio la titularidad. */
  private async participants(tx: Transaction, job: Trabajo, professionalId: string) {
    const company = (await tx.get(this.db.collection(C.EMPRESAS).doc(job.empresaId))).data() as Empresa | undefined;
    const professional = (await tx.get(this.db.collection(C.PROFESIONALES).doc(professionalId))).data() as Profesional | undefined;
    if (!company || !professional) throw new ApiError('No se encontro la coordinacion.', 404);
    return { company, professional };
  }
  /** No revela existencia de trabajos ajenos. */
  private authorize(uid: string, role: CoordinatorRole, w: StoredCoordinator, company: Empresa, professional: Profesional): void {
    if (company.usuarioId !== w.companyUid || professional.usuarioId !== w.professionalUid
      || (role === 'empresa' ? company.usuarioId : professional.usuarioId) !== uid
      || (role === 'profesional' && w.state === 'PROFESSIONAL_SELECTED'))
      throw new ApiError('No se encontro la coordinacion.', 404);
  }
  /** Actualiza workflow, bandeja y metricas en el mismo commit. */
  private save(tx: Transaction, w: StoredCoordinator, job: Trabajo, from: StoredCoordinator['state'], action: string,
    actor: CoordinatorRole | 'system', uid: string | null, note: string | null, payload: unknown = null): void {
    tx.set(this.current(job.id), w);
    tx.set(this.db.collection(C.COORDINATION_WORKFLOWS).doc(job.id), {
      jobId: job.id, title: matchingText(job.titulo, 180), state: w.state, updatedAt: w.updatedAt,
      companyUid: w.companyUid, professionalUid: w.state === 'PROFESSIONAL_SELECTED' ? null : w.professionalUid,
    });
    tx.create(this.job(job.id).collection(C.COORDINATOR_HISTORY).doc(this.eventId(w)), {
      workflowId: w.id, revision: w.revision, action, from, to: w.state, actor, actorUid: uid,
      at: w.updatedAt, note, payload, policyVersion: COORDINATOR_PROMPT_VERSION,
    });
    tx.create(this.db.collection(C.ANALYTICS_EVENTOS).doc(this.eventId(w)), coordinatorEvent(w, action));
  }
  /** Una notificacion interna guardada ya esta disponible, pero no se considera leida. */
  private notify(tx: Transaction, w: StoredCoordinator, recipient: string, message: string): void {
    const id = this.eventId(w);
    tx.create(this.db.collection(C.NOTIFICACIONES).doc(id), {
      id, usuarioId: recipient, tipo: 'alerta_sistema', titulo: 'Coordinacion de tu trabajo',
      mensaje: message, canal: 'in_app', estado: 'enviada', leida: false, enviada: true,
      intentos: 1, maxIntentos: 1, fechaCreacion: new Date(), fechaEnvio: new Date(),
      datos: { jobId: w.jobId, workflowId: w.id, state: w.state, url: '/dashboard/coordination/' + w.jobId },
    });
  }
  /** Snapshot autorizado. Solo la empresa puede leer un Job todavia sin workflow. */
  async read(id: string, uid: string, role: CoordinatorRole): Promise<{ job: Trabajo; workflow: StoredCoordinator | null }> {
    return this.db.runTransaction(async tx => {
      const job = (await tx.get(this.job(id))).data() as Trabajo | undefined;
      if (!job) throw new ApiError('No se encontro la solicitud.', 404);
      const w = (await tx.get(this.current(id))).data() as StoredCoordinator | undefined;
      if (w) {
        const { company, professional } = await this.participants(tx, job, w.professionalId);
        this.authorize(uid, role, w, company, professional);
      } else {
        const company = (await tx.get(this.db.collection(C.EMPRESAS).doc(job.empresaId))).data() as Empresa | undefined;
        if (role !== 'empresa' || company?.usuarioId !== uid) throw new ApiError('No se encontro la solicitud.', 404);
      }
      return { job, workflow: w ?? null };
    });
  }
  /** Devuelve historial publico de la corrida actual, sin payloads ni identidades internas. */
  async history(id: string, workflowId: string): Promise<CoordinatorHistory[]> {
    const docs = await this.job(id).collection(C.COORDINATOR_HISTORY).where('workflowId', '==', workflowId).limit(250).get();
    return docs.docs.map(d => { const v = d.data(); return {
      revision: v.revision, action: v.action, from: v.from, to: v.to, actor: v.actor, at: v.at, note: v.note,
    } as CoordinatorHistory; }).sort((a, b) => a.revision - b.revision);
  }
  /** Inicio explicito; revalida seleccion, profesional y version de Pricing en el mismo commit. */
  async start(id: string, uid: string, command: CoordinatorStart, estimateId: string, expectedSelection: MatchingSelection): Promise<void> {
    await this.db.runTransaction(async tx => {
      const job = (await tx.get(this.job(id))).data() as Trabajo | undefined;
      if (!job) throw new ApiError('No se encontro la solicitud.', 404);
      const old = (await tx.get(this.current(id))).data() as StoredCoordinator | undefined;
      const selection = job.matchingSelection;
      const company = (await tx.get(this.db.collection(C.EMPRESAS).doc(job.empresaId))).data() as Empresa | undefined;
      if (company?.usuarioId !== uid || company.activo === false) throw new ApiError('No se encontro la solicitud.', 404);
      const receipt = this.job(id).collection(C.COORDINATOR_COMMANDS).doc(command.idempotencyKey);
      const previous = (await tx.get(receipt)).data();
      if (previous) {
        if (previous.kind !== 'start' || previous.actorUid !== uid) throw new ApiError('El identificador corresponde a otra accion.', 409);
        return;
      }
      if (old && old.state !== 'CANCELLED') throw new ApiError('Ya existe una coordinacion para esta solicitud.', 409);
      if (!selection || job.estado !== 'publicado') throw new ApiError('Publica el trabajo y selecciona un profesional antes de coordinar.', 409);
      if (selection.professionalId !== expectedSelection.professionalId || selection.runId !== expectedSelection.runId
        || selection.jobFingerprint !== expectedSelection.jobFingerprint || selection.selectedAt !== expectedSelection.selectedAt)
        throw new ApiError('La seleccion cambio durante la validacion de Pricing. Actualiza la pantalla.', 409);
      const { professional } = await this.participants(tx, job, selection.professionalId);
      const matching = (await tx.get(this.job(id).collection(C.MATCHING).doc('current'))).data() as MatchingRun | undefined;
      const pricing = (await tx.get(this.job(id).collection(C.PRICING).doc('current'))).data() as PricingRun | undefined;
      const estimate = (await tx.get(this.job(id).collection(C.PRICING_ESTIMATES).doc(estimateId))).data();
      const context = (await tx.get(this.job(id).collection(C.PRICING).doc('context'))).data();
      const fingerprint = matchingJobFingerprint(job);
      if (!matching || !['completed', 'fallback'].includes(matching.status) || matching.runId !== selection.runId
        || matching.fingerprint !== fingerprint || selection.jobFingerprint !== fingerprint
        || matching.selectedProfessionalId !== selection.professionalId || !(Date.parse(matching.expiresAt ?? '') > Date.now())
        || !isMatchingActive(professional) || professional.disponible === false
        || matching.profileVersions[selection.professionalId] !== matchingProfileFingerprint(professional))
        throw new ApiError('Actualiza Matching y la seleccion del profesional.', 409);
      if (!pricing?.result || pricing.status !== 'completed' || pricing.result.id !== estimateId
        || !(Date.parse(pricing.result.expiresAt) > Date.now()) || estimate?.jobFingerprint !== fingerprint
        || estimate?.revision !== (context?.revision ?? 0))
        throw new ApiError('Actualiza Pricing antes de iniciar la coordinacion.', 409);
      const w: StoredCoordinator = {
        id: randomUUID(), jobId: id, companyId: job.empresaId, companyUid: uid,
        professionalId: selection.professionalId, professionalUid: professional.usuarioId,
        professionalName: matchingText(professional.nombre + ' ' + professional.apellido, 160),
        state: 'PROFESSIONAL_SELECTED', revision: 1, matchingRunId: matching.runId,
        pricingEstimateId: estimateId, pricingInsufficient: pricing.result.status === 'insufficient_data',
        offer: null, schedule: null, completionRequested: false, createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(), jobFingerprint: fingerprint, startKey: command.idempotencyKey,
        jobSnapshot: publicMatchingJob(job),
      };
      this.save(tx, w, job, 'MATCHED', 'started', 'empresa', uid, null,
        { selection, pricingEstimateId: estimateId, professionalVersion: matching.profileVersions[selection.professionalId] });
      tx.update(this.job(id), { coordinationId: w.id, coordinationState: w.state });
      tx.create(receipt, { kind: 'start', actorUid: uid, workflowId: w.id, at: w.createdAt, selection, pricingEstimateId: estimateId });
    });
  }
  /** Recibo durable de inicio, consultado despues de verificar ownership en el servicio. */
  async started(id: string, uid: string, key: string): Promise<boolean> {
    const receipt = (await this.job(id).collection(C.COORDINATOR_COMMANDS).doc(key).get()).data();
    if (!receipt) return false;
    if (receipt.kind !== 'start' || receipt.actorUid !== uid) throw new ApiError('El identificador corresponde a otra accion.', 409);
    return true;
  }
  /** Transicion atomica con presupuesto real, auditoria, estados del Job e idempotencia. */
  async command(id: string, uid: string, role: CoordinatorRole, command: CoordinatorCommand): Promise<void> {
    await this.db.runTransaction(async tx => {
      const jobRef = this.job(id);
      const job = (await tx.get(jobRef)).data() as Trabajo | undefined;
      const w = (await tx.get(this.current(id))).data() as StoredCoordinator | undefined;
      if (!job || !w) throw new ApiError('No se encontro la coordinacion.', 404);
      const { company, professional } = await this.participants(tx, job, w.professionalId);
      this.authorize(uid, role, w, company, professional);
      const receipt = jobRef.collection(C.COORDINATOR_COMMANDS).doc(command.idempotencyKey);
      const previous = (await tx.get(receipt)).data();
      const hash = createHash('sha256').update(JSON.stringify(command)).digest('hex');
      if (previous) {
        if (previous.hash !== hash || previous.actorUid !== uid || previous.workflowId !== w.id)
          throw new ApiError('El identificador de reintento pertenece a otra accion.', 409);
        return;
      }
      if (w.revision >= 200 && (command.action === 'counter_offer' || command.action === 'propose_schedule' && w.schedule !== null))
        throw new ApiError('Se alcanzo el limite de cambios de condiciones. Acepta las condiciones vigentes o cancela.', 409);
      if (['cancelado', 'completado'].includes(job.estado)) throw new ApiError('El trabajo ya esta cerrado.', 409);
      if (command.action !== 'cancel' && matchingJobFingerprint(job) !== w.jobFingerprint)
        throw new ApiError('El trabajo cambio fuera de la coordinacion. Revisa la solicitud.', 409);
      if (command.action !== 'cancel' && (!isMatchingActive(professional) || company.activo === false))
        throw new ApiError('Uno de los participantes ya no esta habilitado.', 409);
      const next: StoredCoordinator = { ...w, ...transitionCoordinator(w, role, command) };
      if (command.quote) next.charges = contractCharges(command.quote.amount, command.quote.currency, command.quote.id);
      const oldProposalRef = w.offer ? this.db.collection(C.PROPUESTAS).doc(w.id + '_' + w.offer.quote.id) : null;
      const oldProposal = oldProposalRef ? await tx.get(oldProposalRef) : null;
      const quoteRef = command.quote ? this.db.collection(C.PROPUESTAS).doc(w.id + '_' + command.quote.id) : null;
      const quoteDoc = quoteRef ? await tx.get(quoteRef) : null;
      const versionRef = command.quote ? jobRef.collection(C.COORDINATOR_OFFERS).doc(w.id + '_' + command.quote.id) : null;
      const version = versionRef ? await tx.get(versionRef) : null;
      const protectedRef = this.db.collection(PROTECTED_COLLECTIONS.contracts).doc(id);
      const protectedContract = (await tx.get(protectedRef)).data() as StoredProtectedContract | undefined;
      const nextProtected = protectedContract ? transitionProtectedWork(protectedContract, w, next, command) : null;
      const matchingRef = jobRef.collection(C.MATCHING).doc('current');
      const matching = command.action === 'cancel' ? await tx.get(matchingRef) : null;
      const matchRef = jobRef.collection(C.MATCHES).doc(w.professionalId);
      const match = command.action === 'cancel' ? await tx.get(matchRef) : null;
      if (command.quote && (w.offer?.quote.id === command.quote.id || quoteDoc?.exists || version?.exists))
        throw new ApiError('Usa un identificador nuevo para cada version del presupuesto.', 409);
      const patch: Record<string, unknown> = { coordinationId: w.id, coordinationState: next.state, fechaActualizacion: new Date(), updatedAt: new Date() };
      if (role === 'profesional' && (command.quote || command.action === 'accept_quote')) {
        await new SubscriptionRepository(this.db).consumeQuota(tx, uid, 'profesional', 'propuestasEnviadas', 'proposal_' + w.id);
      }
      if (command.action === 'confirm_schedule') {
        patch.profesionalAsignadoId = w.professionalId; patch.estado = 'en_revision'; patch.status = 'en_revision';
        patch.fechaInicio = new Date(next.schedule!.startsAt); patch.fechaFin = new Date(next.schedule!.endsAt);
      }
      if (command.action === 'start_work') { patch.estado = 'en_progreso'; patch.status = 'en_progreso'; }
      if (command.action === 'complete') {
        patch.estado = 'completado'; patch.status = 'completado';
        tx.update(this.db.collection(C.PROFESIONALES).doc(w.professionalId), { totalTrabajos: (professional.totalTrabajos ?? 0) + 1 });
        tx.update(this.db.collection(C.EMPRESAS).doc(w.companyId), { totalContrataciones: (company.totalContrataciones ?? 0) + 1 });
        tx.create(this.db.collection(C.COORDINATOR_OUTBOX).doc(w.id + '_completed'), {
          type: 'job.completed', jobId: id, workflowId: w.id, professionalId: w.professionalId,
          companyId: w.companyId, status: 'awaiting_reviews', createdAt: new Date().toISOString(),
        });
      }
      if (command.action === 'cancel') {
        patch.profesionalAsignadoId = FieldValue.delete(); patch.matchingSelection = null;
        patch.estado = role === 'empresa' ? 'cancelado' : 'publicado'; patch.status = patch.estado;
        if (matching?.data()?.selectedProfessionalId === w.professionalId) tx.update(matchingRef, { selectedProfessionalId: null });
        if (match?.exists) tx.update(matchRef, { state: 'recommended' });
        if (oldProposal?.exists && oldProposalRef) tx.update(oldProposalRef, { estado: 'retirada', fechaRespuesta: new Date() });
      }
      if (command.quote && oldProposal?.exists && oldProposalRef) tx.update(oldProposalRef, { estado: 'rechazada', fechaRespuesta: new Date() });
      if (command.quote && role === 'profesional' && quoteRef) {
        tx.create(quoteRef, this.proposal(next, command.quote, 'enviada'));
        patch.propuestasRecibidas = job.propuestasRecibidas + 1;
      }
      if (command.action === 'accept_quote' && next.offer && oldProposalRef) {
        if (oldProposal?.exists) tx.update(oldProposalRef, { estado: 'aceptada', fechaRespuesta: new Date() });
        else {
          tx.create(oldProposalRef, this.proposal(next, next.offer.quote, 'aceptada'));
          patch.propuestasRecibidas = job.propuestasRecibidas + 1;
        }
      }
      next.jobFingerprint = matchingJobFingerprint({ ...job, ...patch } as Trabajo);
      next.jobSnapshot = publicMatchingJob({ ...job, ...patch } as Trabajo);
      if (versionRef && command.quote) tx.create(versionRef, {
        workflowId: w.id, revision: next.revision, quote: command.quote, proposedBy: role, at: next.updatedAt,
      });
      this.save(tx, next, job, w.state, command.action, role, uid, command.note ?? null, command);
      if (nextProtected) {
        tx.set(protectedRef, nextProtected);
        new ProtectedContractRepository(this.db).audit(tx, id, { uid, rol: role }, command.action,
          { workState: protectedContract!.workState }, { workState: nextProtected.workState }, command.idempotencyKey);
      }
      tx.update(jobRef, patch);
      tx.create(receipt, { kind: 'command', hash, actorUid: uid, workflowId: w.id, revision: next.revision, at: next.updatedAt });
      if (command.action !== 'contact') this.notify(tx, next, role === 'empresa' ? w.professionalUid : w.companyUid,
        'La coordinacion avanzo a ' + next.state + '. Revisa los detalles en OfiAI.');
    });
  }
  /** Propuesta comercial real, consentida por el profesional y compatible con Pricing. */
  private proposal(w: StoredCoordinator, q: NonNullable<CoordinatorCommand['quote']>, state: 'enviada' | 'aceptada') {
    return { id: w.id + '_' + q.id, trabajoId: w.jobId, empresaId: w.companyId, profesionalId: w.professionalId,
      descripcion: q.scope, precioOfertado: q.amount, moneda: q.currency, estado: state, generadaConIA: false,
      fechaEnvio: new Date(), fechaRespuesta: state === 'aceptada' ? new Date() : null,
      pricingTerms: { scope: q.scope, unit: q.unit, quantity: q.quantity, materials: q.materials, taxes: q.taxes, validUntil: q.validUntil },
      coordinatorWorkflowId: w.id, proposedBy: w.offer?.proposedBy ?? 'profesional' };
  }
  /** Entrega de contacto recuperable; nunca inventa lectura o respuesta del destinatario. */
  async deliver(id: string): Promise<boolean> {
    return this.db.runTransaction(async tx => {
      const job = (await tx.get(this.job(id))).data() as Trabajo | undefined;
      const w = (await tx.get(this.current(id))).data() as StoredCoordinator | undefined;
      if (!job || !w || w.state !== 'CONTACT_PENDING') return false;
      const { company, professional } = await this.participants(tx, job, w.professionalId);
      if (company.usuarioId !== w.companyUid || professional.usuarioId !== w.professionalUid
        || !isMatchingActive(professional) || ['cancelado', 'completado'].includes(job.estado)) return false;
      const next = { ...w, state: 'CONTACTED' as const, revision: w.revision + 1, updatedAt: new Date().toISOString() };
      this.notify(tx, next, w.professionalUid, 'Una empresa te invita a conversar sobre un trabajo. Revisa y responde desde Coordinacion.');
      this.save(tx, next, job, w.state, 'invitation_delivered', 'system', null, null);
      tx.update(this.job(id), { coordinationState: next.state });
      return true;
    });
  }
  /** Bandeja por participante; cursor de documento evita scans sin limite e indices compuestos. */
  async list(uid: string, role: CoordinatorRole, cursor?: string): Promise<CoordinatorList> {
    let query = this.db.collection(C.COORDINATION_WORKFLOWS).where(role === 'empresa' ? 'companyUid' : 'professionalUid', '==', uid).orderBy('__name__').limit(31);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    const docs = snapshot.docs.slice(0, 30);
    const items: CoordinatorList['items'] = [];
    for (const doc of docs) {
      try {
        const { job, workflow } = await this.read(doc.id, uid, role);
        if (workflow) items.push({ jobId: job.id, title: role === 'profesional' ? workflow.jobSnapshot.title : matchingText(job.titulo, 180), state: workflow.state, updatedAt: workflow.updatedAt });
      } catch (error) {
        if (!(error instanceof ApiError && error.codigoEstado === 404)) throw error;
      }
    }
    return { items, nextCursor: snapshot.size > 30 ? docs[docs.length - 1].id : null };
  }
  /** Recupera invitaciones interrumpidas desde el scheduler existente. */
  async pending(): Promise<string[]> {
    const docs = await this.db.collection(C.COORDINATION_WORKFLOWS).where('state', '==', 'CONTACT_PENDING').limit(50).get();
    return docs.docs.map(d => d.id);
  }
}
export const coordinatorRepository = new CoordinatorRepository();
