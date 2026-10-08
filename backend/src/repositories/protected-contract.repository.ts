/** @archivo protected-contract.repository.ts @descripcion Expediente transaccional, grants revocables y auditoria append-only. */
import { createHash, randomUUID } from 'node:crypto';
import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES as C } from '../database/firestore/collections';
import { PROTECTED_COLLECTIONS as P, defaultContractPolicy, FINANCIAL_OWNER_EMAILS } from '../constants/protected-payments';
import { ApiError } from '../middleware/error.middleware';
import { calculateContractCharges, decimalToMinor } from '../utils/contract-money';
import type { FinancialActor, FinancialGrant, StoredProtectedContract, ContractPolicy } from '../models/protected-contract.model';
import type { StoredCoordinator } from '../models/coordinator.model';
import type { ContractCommand } from '../validators/protected-contract.validator';
import type { ContractEntry } from '../../../shared/protected-contract';

/** Huella interna de datos normalizados; no se almacena contenido en logs. */
function fingerprint(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
/** Revalida MFA de Firebase y antiguedad de autenticacion, no un campo editable del usuario. */
export function requireFinancialMfa(actor: FinancialActor): void {
  const age = Date.now() / 1000 - (actor.authTime ?? 0);
  if (!actor.secondFactor || age < 0 || age > 600) throw new ApiError('Esta accion requiere MFA y una autenticacion de los ultimos 10 minutos.', 403);
}
/** No efectua llamadas a proveedores dentro de transacciones de Firestore. */
export class ProtectedContractRepository {
  /** Inyeccion exclusiva para emulador/pruebas y composicion existente. */
  constructor(private readonly db: Firestore = firestore) {}
  /** Un expediente financiero por Job, sin reemplazar Coordinator. */
  private ref(id: string) { return this.db.collection(P.contracts).doc(id); }
  /** Usuario y grants se consultan nuevamente en cada operacion; la revocacion es inmediata. */
  private async grant(tx: Transaction, actor: FinancialActor): Promise<FinancialGrant | null> {
    const user = (await tx.get(this.db.collection(C.USUARIOS).doc(actor.uid))).data();
    if (!user?.activo || user.rol !== actor.rol) throw new ApiError('Cuenta no habilitada.', 403);
    const grant = (await tx.get(this.db.collection(P.grants).doc(actor.uid))).data() as FinancialGrant | undefined;
    if (grant?.role === 'OWNER' && (!actor.emailVerificado || !FINANCIAL_OWNER_EMAILS.includes(actor.email?.trim().toLowerCase() ?? '')))
      throw new ApiError('OWNER requiere uno de los correos propietarios verificado en Firebase.', 403);
    return actor.rol === 'admin' && grant?.active && grant.uid === actor.uid ? grant : null;
  }
  /** Autorizacion administrativa independiente del rol admin general. */
  private admin(actor: FinancialActor, grant: FinancialGrant | null, c: StoredProtectedContract | null,
    permission: FinancialGrant['permissions'][number], sensitive = false): void {
    if (!grant || (grant.role !== 'OWNER' && (!grant.permissions.includes(permission) || !c || c.assignedUid !== actor.uid)))
      throw new ApiError('No tenes permisos para esta operacion.', 403);
    if (c && [c.companyUid, c.professionalUid].includes(actor.uid)) throw new ApiError('No podes administrar una contratacion propia.', 403);
    if (sensitive) requireFinancialMfa(actor);
  }
  /** Verifica titulares actuales del Job y profesional, no solamente los UID del snapshot. */
  private async access(tx: Transaction, id: string, actor: FinancialActor) {
    const c = (await tx.get(this.ref(id))).data() as StoredProtectedContract | undefined;
    const grant = await this.grant(tx, actor);
    if (!c) throw new ApiError('Contratacion no encontrada.', 404);
    const job = (await tx.get(this.db.collection(C.TRABAJOS).doc(id))).data();
    const company = job ? (await tx.get(this.db.collection(C.EMPRESAS).doc(job.empresaId))).data() : null;
    const pro = (await tx.get(this.db.collection(C.PROFESIONALES).doc(c.professionalId))).data();
    if (!job || !company || !pro || company.usuarioId !== c.companyUid || pro.usuarioId !== c.professionalUid)
      throw new ApiError('La titularidad del acuerdo requiere revision.', 409);
    const party = (actor.rol === 'empresa' && c.companyUid === actor.uid) || (actor.rol === 'profesional' && c.professionalUid === actor.uid);
    if (!party) { if (!grant) throw new ApiError('Contratacion no encontrada.', 404); this.admin(actor, grant, c, 'view'); }
    return { c, grant, party };
  }
  /** Solo create; no hay rutas que actualicen o borren el historial. */
  audit(tx: Transaction, id: string, actor: FinancialActor | null, action: string, before: unknown, after: unknown, correlationId: string, reason: string | null = null): void {
    const eventId = randomUUID();
    tx.create(this.db.collection(P.audit).doc(eventId), { id: eventId, entityId: id,
      actorUid: actor?.uid ?? 'provider', role: actor?.rol ?? 'provider', action, before, after,
      at: new Date().toISOString(), serverAt: FieldValue.serverTimestamp(), correlationId, reason });
  }
  /** Notificacion interna sin datos del reclamo ni documentos privados. */
  private notify(tx: Transaction, c: StoredProtectedContract, actorUid: string): void {
    for (const uid of [c.companyUid, c.professionalUid].filter(uid => uid !== actorUid)) {
      const id = randomUUID(); tx.create(this.db.collection(C.NOTIFICACIONES).doc(id), {
        id, usuarioId: uid, tipo: 'alerta_sistema', titulo: 'Actualizacion de tu contratacion',
        mensaje: 'Hay una actualizacion en el expediente de tu trabajo.', canal: 'in_app', estado: 'enviada',
        leida: false, enviada: true, intentos: 1, maxIntentos: 1, fechaCreacion: new Date(),
        datos: { jobId: c.id, url: '/dashboard/coordination/' + c.id },
      });
    }
  }
  /** Snapshot generado exclusivamente desde la oferta aceptada y la politica vigente del servidor. */
  async prepare(id: string, actor: FinancialActor): Promise<StoredProtectedContract> {
    return this.db.runTransaction(async tx => {
      await this.grant(tx, actor);
      const jobRef = this.db.collection(C.TRABAJOS).doc(id);
      const job = (await tx.get(jobRef)).data();
      const w = (await tx.get(jobRef.collection(C.COORDINATOR).doc('current'))).data() as StoredCoordinator | undefined;
      const company = job ? (await tx.get(this.db.collection(C.EMPRESAS).doc(job.empresaId))).data() : null;
      if (actor.rol !== 'empresa' || company?.usuarioId !== actor.uid || !w || w.companyUid !== actor.uid) throw new ApiError('Acuerdo no encontrado.', 404);
      if (!w.offer?.accepted || ['CANCELLED','COMPLETED'].includes(w.state)) throw new ApiError('Primero deben aceptar un presupuesto vigente.', 409);
      const old = (await tx.get(this.ref(id))).data() as StoredProtectedContract | undefined;
      if (old) {
        if (old.workflowId !== w.id || old.quoteFingerprint !== fingerprint(w.offer.quote)) throw new ApiError('El presupuesto del expediente es inmutable.', 409);
        if (old.acceptedAt) return old;
      }
      const quote = w.offer.quote;
      const configured = (await tx.get(this.db.collection(P.policies).doc(quote.currency))).data() as ContractPolicy | undefined;
      const policy = configured ?? defaultContractPolicy(quote.currency);
      const breakdown = calculateContractCharges(decimalToMinor(quote.amount, policy.minorDigits), job!.categoria ?? '', policy);
      const now = new Date().toISOString();
      if (old) {
        if (old.policy.version===policy.version) return old;
        const before=old.breakdown; old.breakdown=breakdown;old.policy=policy;old.revision++;old.updatedAt=now;
        tx.set(this.ref(id),old);this.audit(tx,id,actor,'unaccepted_breakdown_updated',before,breakdown,randomUUID());return old;
      }
      const c: StoredProtectedContract = { id, revision: 1, workflowId: w.id, quoteId: quote.id,
        workState: w.state, financialState: 'UNPAID', breakdown, policy, companyUid: w.companyUid,
        professionalId: w.professionalId, professionalUid: w.professionalUid, quoteFingerprint: fingerprint(quote),
        acceptedAt: null, professionalCompletedAt: null, clientApprovedAt: null, dispute: null,
        refundedMinor: 0,
        assignedUid: null, resolutionProposer: null, resolutionApprovers: [], approvalGrantVersions: {}, updatedAt: now };
      tx.create(this.ref(id), c); this.audit(tx, id, actor, 'quote_snapshot_created', null, { quoteId: c.quoteId, breakdown }, randomUUID());
      return c;
    });
  }
  /** Lectura autorizada que el servicio proyecta antes de entregar al cliente. */
  async read(id: string, actor: FinancialActor): Promise<StoredProtectedContract> {
    return this.db.runTransaction(async tx => (await this.access(tx, id, actor)).c);
  }
  /** Cambios comerciales y humanos, separados de solicitudes al proveedor. */
  async command(id: string, actor: FinancialActor, cmd: ContractCommand): Promise<StoredProtectedContract> {
    return this.db.runTransaction(async tx => {
      const { c, grant, party } = await this.access(tx, id, actor);
      const receipt = this.ref(id).collection('commands').doc(cmd.idempotencyKey);
      const previous = (await tx.get(receipt)).data(); const hash = fingerprint(cmd);
      if (previous) { if (previous.hash !== hash || previous.uid !== actor.uid) throw new ApiError('Clave de reintento incompatible.', 409); return c; }
      if (c.revision !== cmd.revision) throw new ApiError('El expediente cambio. Actualiza antes de continuar.', 409);
      const before = { workState: c.workState, financialState: c.financialState, disputeState: c.dispute?.state ?? null };
      const at = new Date().toISOString(); let entry: ContractEntry | null = null;
      if (cmd.action === 'accept_terms') {
        if (actor.uid !== c.companyUid || !party) throw new ApiError('Solo el contratante puede aceptar.', 403);
        if (!c.breakdown.chargesVerified) throw new ApiError('Primero deben verificarse los costos del proveedor y actualizar el desglose.', 409);
        if (c.acceptedAt || cmd.termsVersion !== c.breakdown.termsVersion) throw new ApiError('Las condiciones ya fueron aceptadas o cambiaron.', 409);
        c.acceptedAt = at;
      } else if (cmd.action === 'open_dispute') {
        if (!party) throw new ApiError('Solo los participantes pueden reclamar.', 403);
        if (c.dispute) throw new ApiError('Ya existe un reclamo. Utiliza su expediente o la apelacion.', 409);
        c.dispute = { id: randomUUID(), reason: cmd.reason, state: 'OPEN', priority: c.financialState !== 'UNPAID' ? 'high' : 'normal', openedAt: at, resolution: null };
      } else if (cmd.action === 'message' || cmd.action === 'appeal') {
        if (!c.dispute) throw new ApiError('Primero abre un reclamo.', 409);
        if (!party) this.admin(actor, grant, c, 'communicate');
        if (cmd.action === 'appeal') {
          if (!party || !['RESOLVED','PROPOSED'].includes(c.dispute.state)) throw new ApiError('No hay una resolucion apelable.', 409);
          c.dispute.state = 'APPEALED'; c.resolutionApprovers = []; c.approvalGrantVersions = {};
          if (c.dispute.resolution) c.dispute.resolution.approved = false;
        }
        entry = { id: cmd.idempotencyKey, kind: cmd.action === 'appeal' ? 'appeal' : 'message', actorRole: actor.rol, text: cmd.action === 'appeal' ? cmd.reason : cmd.text, at };
      } else if (cmd.action === 'assign') {
        this.admin(actor, grant, c, 'resolve', true);
        if (grant?.role !== 'OWNER' || !c.dispute || [c.companyUid,c.professionalUid].includes(cmd.uid)) throw new ApiError('Asignacion no permitida.', 403);
        const target = (await tx.get(this.db.collection(P.grants).doc(cmd.uid))).data() as FinancialGrant | undefined;
        const targetUser = (await tx.get(this.db.collection(C.USUARIOS).doc(cmd.uid))).data();
        if (!target?.active || !targetUser?.activo || targetUser.rol !== 'admin') throw new ApiError('Administrador no habilitado.', 409);
        c.assignedUid = cmd.uid; c.dispute.state = 'UNDER_REVIEW';
      } else {
        this.admin(actor, grant, c, cmd.action === 'propose' ? 'propose' : 'resolve', true);
        if (!c.dispute) throw new ApiError('Reclamo no disponible.', 409);
        if (cmd.action === 'propose') {
          if (c.dispute.state === 'RESOLVED') throw new ApiError('Se requiere una apelacion para revisar la decision.', 409);
          const remaining = c.breakdown.clientTotalMinor - c.refundedMinor;
          if ((cmd.kind === 'PARTIAL_REFUND' && !(cmd.refundMinor > 0 && cmd.refundMinor < remaining)) ||
            (cmd.kind === 'FULL_REFUND' && cmd.refundMinor !== remaining) ||
            (!['PARTIAL_REFUND','FULL_REFUND'].includes(cmd.kind) && cmd.refundMinor !== 0)) throw new ApiError('Importe de resolucion invalido.', 400);
          c.dispute.resolution = { id: randomUUID(), kind: cmd.kind, reason: cmd.reason, refundMinor: cmd.refundMinor, proposedAt: at, approved: false, approvalCount: 0 };
          c.resolutionProposer = actor.uid; c.resolutionApprovers = []; c.dispute.state = 'PROPOSED';
          c.approvalGrantVersions = { [actor.uid]: grant!.revision };
        } else {
          const r = c.dispute.resolution;
          if (!r || r.id !== cmd.resolutionId || r.approved || c.dispute.state !== 'PROPOSED') throw new ApiError('Resolucion desactualizada.', 409);
          const amount = r.kind === 'FULL_PAYMENT' ? c.breakdown.clientTotalMinor : r.refundMinor;
          if (grant!.role !== 'OWNER' && amount > (grant!.limitsMinor[c.breakdown.currency] ?? 0)) throw new ApiError('La resolucion supera tu limite autorizado.', 403);
          const proposer = (await tx.get(this.db.collection(P.grants).doc(c.resolutionProposer!))).data() as FinancialGrant | undefined;
          if (!proposer?.active || proposer.revision !== c.approvalGrantVersions[c.resolutionProposer!]) throw new ApiError('Se modificaron los permisos de quien propuso la resolucion.', 409);
          if (c.resolutionApprovers.includes(actor.uid)) throw new ApiError('Tu aprobacion ya esta registrada.', 409);
          const financial = ['FULL_PAYMENT','FULL_REFUND','PARTIAL_REFUND'].includes(r.kind);
          const dual = financial && amount >= c.policy.dualApprovalMinor;
          if (dual && actor.uid === c.resolutionProposer) throw new ApiError('La propuesta requiere aprobacion independiente.', 403);
          c.resolutionApprovers.push(actor.uid); r.approvalCount = c.resolutionApprovers.length;
          c.approvalGrantVersions[actor.uid] = grant!.revision;
          // Propuesta + aprobacion independiente forman el doble control; nunca ejecutan dinero aqui.
          r.approved = true; c.dispute.state = r.kind === 'ESCALATE' ? 'UNDER_REVIEW' : r.kind === 'MORE_INFORMATION' || r.kind === 'CORRECTION' ? 'UNDER_REVIEW' : 'RESOLVED';
        }
      }
      c.revision++; c.updatedAt = at;
      tx.set(this.ref(id), c); tx.create(receipt, { hash, uid: actor.uid, at });
      if (entry) tx.create(this.ref(id).collection('entries').doc(entry.id), entry);
      this.audit(tx, id, actor, cmd.action, before, { workState: c.workState, financialState: c.financialState, disputeState: c.dispute?.state ?? null }, cmd.idempotencyKey, 'reason' in cmd ? cmd.reason : null);
      this.notify(tx, c, actor.uid); return c;
    });
  }
  /** Mensajes/evidencias append-only, siempre despues de ownership actual. */
  async entries(id: string, actor: FinancialActor): Promise<ContractEntry[]> {
    await this.read(id, actor);
    const result = await this.ref(id).collection('entries').orderBy('at', 'desc').limit(100).get();
    return result.docs.map(doc => doc.data() as ContractEntry).reverse();
  }
  /** Evidencia inmutable: metadata y huella creadas una vez, sin endpoint de edicion. */
  async addEvidence(id: string, actor: FinancialActor, evidence: { id: string; path: string; sha256: string; mime: string; size: number; caption: string }): Promise<void> {
    await this.db.runTransaction(async tx => {
      const { c, grant, party } = await this.access(tx, id, actor);
      if (!party) this.admin(actor, grant, c, 'communicate');
      const at = new Date().toISOString();
      tx.create(this.ref(id).collection('evidence').doc(evidence.id), { ...evidence, actorUid: actor.uid, at });
      tx.create(this.ref(id).collection('entries').doc(evidence.id), { id: evidence.id, kind: 'evidence', evidenceId: evidence.id, actorRole: actor.rol, text: evidence.caption, at });
      this.audit(tx, id, actor, 'evidence_added', null, { evidenceId: evidence.id, sha256: evidence.sha256 }, evidence.id);
      this.notify(tx, c, actor.uid);
    });
  }
  /** La ruta de Storage se resuelve desde metadata del servidor, no desde el cliente. */
  async evidence(id: string, actor: FinancialActor, evidenceId: string): Promise<{ path: string; mime: string; size: number; sha256: string }> {
    await this.read(id, actor);
    const doc = (await this.ref(id).collection('evidence').doc(evidenceId).get()).data();
    if (!doc || doc.path !== 'contract-evidence/' + id + '/' + evidenceId) throw new ApiError('Evidencia no encontrada.', 404);
    return { path: doc.path, mime: doc.mime, size: doc.size, sha256: doc.sha256 };
  }
  /** Lista acotada por asignacion; los propietarios pueden inspeccionar toda la bandeja reciente. */
  async list(actor: FinancialActor): Promise<StoredProtectedContract[]> {
    const grant = await this.db.runTransaction(tx => this.grant(tx, actor));
    if (!grant || (grant.role !== 'OWNER' && !grant.permissions.includes('view'))) throw new ApiError('Sin permiso para el centro de resolucion.', 403);
    const collection = this.db.collection(P.contracts);
    const result = grant.role === 'OWNER' ? await collection.orderBy('updatedAt','desc').limit(100).get()
      : await collection.where('assignedUid','==',actor.uid).limit(100).get();
    return result.docs.map(doc => doc.data() as StoredProtectedContract).filter(c => c.dispute && ![c.companyUid,c.professionalUid].includes(actor.uid));
  }
  /** Politica versionada; nunca altera snapshots previamente aceptados. */
  async setPolicy(actor: FinancialActor, policy: ContractPolicy, reason: string): Promise<void> {
    await this.db.runTransaction(async tx => {
      const grant = await this.grant(tx, actor); this.admin(actor, grant, null, 'finance', true);
      if (grant?.role !== 'OWNER') throw new ApiError('Solo OWNER puede configurar comisiones.', 403);
      const ref = this.db.collection(P.policies).doc(policy.currency); const previous = (await tx.get(ref)).data();
      const versionRef = ref.collection('versions').doc(policy.version);
      if ((await tx.get(versionRef)).exists) throw new ApiError('La version de las reglas ya existe.', 409);
      tx.create(versionRef, policy); tx.set(ref, policy);
      this.audit(tx, policy.currency, actor, 'commission_policy_changed', previous?.version ?? null, policy.version, randomUUID(), reason);
    });
  }
  /** Politica editable por OWNER; se muestra su version antes de preparar otra. */
  async policy(actor: FinancialActor, currency: string): Promise<ContractPolicy> {
    return this.db.runTransaction(async tx=>{await this.requireOwner(tx,actor);
      return (await tx.get(this.db.collection(P.policies).doc(currency))).data() as ContractPolicy|undefined ?? defaultContractPolicy(currency);});
  }
  /** Solo OWNER puede otorgar/revocar DISPUTE_ADMIN; ningun endpoint crea propietarios. */
  async setGrant(actor: FinancialActor, input: Omit<FinancialGrant,'role'|'revision'|'updatedAt'>, reason: string): Promise<void> {
    await this.db.runTransaction(async tx => {
      const grant = await this.grant(tx, actor); this.admin(actor, grant, null, 'finance', true);
      if (grant?.role !== 'OWNER' || input.uid === actor.uid) throw new ApiError('No podes modificar estos permisos.', 403);
      const ref = this.db.collection(P.grants).doc(input.uid); const previous = (await tx.get(ref)).data();
      const user = (await tx.get(this.db.collection(C.USUARIOS).doc(input.uid))).data();
      if (previous?.role === 'OWNER' || !user?.activo || user.rol !== 'admin') throw new ApiError('Se requiere un administrador existente, no propietario.', 409);
      const next: FinancialGrant = { ...input, role: 'DISPUTE_ADMIN', revision: (previous?.revision ?? 0) + 1, updatedAt: new Date().toISOString() };
      tx.set(ref, next); this.audit(tx, input.uid, actor, 'financial_permissions_changed', previous ?? null, next, randomUUID(), reason);
    });
  }
  /** Auditoria de solo lectura: asignados ven solo el expediente autorizado. */
  async history(id: string, actor: FinancialActor): Promise<unknown[]> {
    await this.db.runTransaction(async tx => { const { c, grant } = await this.access(tx, id, actor); this.admin(actor, grant, c, 'view'); });
    return (await this.db.collection(P.audit).where('entityId','==',id).limit(200).get()).docs.map(doc => doc.data());
  }
  /** Control reutilizable del dashboard de liquidaciones; no basta ser admin general. */
  async requireOwner(tx: Transaction, actor: FinancialActor, sensitive = false): Promise<void> {
    const grant = await this.grant(tx,actor);
    if (grant?.role !== 'OWNER') throw new ApiError('Se requiere el permiso OWNER de operaciones financieras.',403);
    if (sensitive) requireFinancialMfa(actor);
  }
}
export const protectedContractRepository = new ProtectedContractRepository();
