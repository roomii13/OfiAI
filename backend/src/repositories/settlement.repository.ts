/** @archivo settlement.repository.ts @descripcion Desglose y registro de liquidacion manual sin perder la comision de OfiAI. */
import { createHash, randomUUID } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { firestore } from '../integrations/firebase/admin';
import { ProtectedContractRepository } from './protected-contract.repository';
import { PROTECTED_COLLECTIONS as P } from '../constants/protected-payments';
import { COLECCIONES as C } from '../database/firestore/collections';
import { ApiError } from '../middleware/error.middleware';
import type { FinancialActor, StoredProtectedContract } from '../models/protected-contract.model';
import type { SettlementAccount, SettlementRow, SettlementOverview } from '../../../shared/settlements';

export const SETTLEMENT_COLLECTIONS = { accounts:'settlement_accounts', receipts:'contract_payment_receipts', transfers:'contract_transfers', references:'settlement_references', checkouts:'contract_checkouts' } as const;
/** Estado obtenido de Mercado Pago, nunca de una captura de pantalla o del frontend. */
export interface ContractPaymentReceipt {
  id: string; contractId: string; status: string; currency: string; amountMinor: number;
  netReceivedMinor: number | null; refundedMinor: number; updatedAt: string; verifiedAt: string;
}
/** Un intento pendiente o rechazado no prueba que exista un ingreso. */
function hasConfirmedCollection(payment: ContractPaymentReceipt | null): boolean {
  return !!payment && ['approved','refunded','charged_back'].includes(payment.status);
}
/** Saldo realmente acreditado debe cubrir profesional, comision y obligaciones tributarias. */
export function settlementAmounts(c: StoredProtectedContract, payment: ContractPaymentReceipt | null) {
  const b = c.breakdown;
  const net = hasConfirmedCollection(payment) ? payment?.netReceivedMinor ?? null : null;
  const providerCosts = net === null || !payment ? null : payment.amountMinor - net;
  const platformTax = Number((BigInt(b.commissionMinor) * BigInt(c.policy.platformTaxBps) + 5000n) / 10000n);
  return { providerCostsActualMinor: providerCosts,
    ofiaiNetActualMinor: net === null ? null : net - b.professionalMinor - platformTax,
    shortageMinor: net === null ? null : Math.max(0,b.professionalMinor + b.commissionMinor + platformTax - net) };
}
/** Repositorio separado de suscripciones: no mezcla revenue SaaS con fondos de contrataciones. */
export class SettlementRepository {
  private readonly contracts: ProtectedContractRepository;
  /** Firestore inyectable para pruebas sin saldos reales. */
  constructor(private readonly db: Firestore = firestore) { this.contracts = new ProtectedContractRepository(db); }
  /** Comprueba cuenta activa y rol desde datos autoritativos. */
  private async professional(tx: Transaction, actor: FinancialActor): Promise<void> {
    const user = (await tx.get(this.db.collection(C.USUARIOS).doc(actor.uid))).data();
    if (!user?.activo || user.rol !== 'profesional' || actor.rol !== 'profesional') throw new ApiError('Solo el profesional puede editar su cuenta de cobro.',403);
  }
  /** La titularidad no se autoverifica al guardar un alias. */
  async saveAccount(actor: FinancialActor, input: Pick<SettlementAccount,'holder'|'account'|'kind'|'currency'>): Promise<void> {
    await this.db.runTransaction(async tx => {
      await this.professional(tx,actor); const ref = this.db.collection(SETTLEMENT_COLLECTIONS.accounts).doc(actor.uid);
      const previous = (await tx.get(ref)).data(); const at = new Date().toISOString();
      tx.set(ref,{ ...input, version:(previous?.version ?? 0)+1, verified:false, updatedAt:at });
      this.contracts.audit(tx,actor.uid,actor,'settlement_account_changed',previous?.version ?? null,(previous?.version ?? 0)+1,randomUUID());
    });
  }
  /** Datos bancarios propios, sin acceso publico al perfil financiero. */
  async ownAccount(actor: FinancialActor): Promise<SettlementAccount | null> {
    return this.db.runTransaction(async tx => { await this.professional(tx,actor);
      return (await tx.get(this.db.collection(SETTLEMENT_COLLECTIONS.accounts).doc(actor.uid))).data() as SettlementAccount | undefined ?? null; });
  }
  /** OWNER verifica manualmente titular y cuenta; sesion reciente y version exacta. */
  async verifyAccount(actor: FinancialActor, uid: string, version: number, reason: string): Promise<void> {
    await this.db.runTransaction(async tx => {
      await this.contracts.requireOwner(tx,actor,true);
      if (actor.uid === uid) throw new ApiError('No podes verificar tu propia cuenta de destino.',403);
      const ref = this.db.collection(SETTLEMENT_COLLECTIONS.accounts).doc(uid); const data = (await tx.get(ref)).data();
      if (!data || data.version !== version) throw new ApiError('La cuenta cambio. Verifica nuevamente la titularidad.',409);
      tx.update(ref,{ verified:true,verifiedBy:actor.uid,verifiedAt:new Date().toISOString() });
      this.contracts.audit(tx,uid,actor,'settlement_account_verified',false,true,randomUUID(),reason);
    });
  }
  /** Expediente, comprobantes y destino se leen dentro de la misma transaccion. */
  private async row(tx: Transaction, c: StoredProtectedContract): Promise<SettlementRow> {
    const payment = (await tx.get(this.db.collection(SETTLEMENT_COLLECTIONS.receipts).doc(c.id))).data() as ContractPaymentReceipt | undefined;
    const accountData = (await tx.get(this.db.collection(SETTLEMENT_COLLECTIONS.accounts).doc(c.professionalUid))).data() as SettlementAccount | undefined;
    const account: SettlementAccount | null = accountData ? { holder:accountData.holder, account:accountData.account,kind:accountData.kind,currency:accountData.currency,
      version:accountData.version,verified:accountData.verified,updatedAt:accountData.updatedAt } : null;
    const transfer = (await tx.get(this.db.collection(SETTLEMENT_COLLECTIONS.transfers).doc(c.id))).data() as SettlementRow['transfer'] | undefined;
    const pro = (await tx.get(this.db.collection(C.PROFESIONALES).doc(c.professionalId))).data();
    const client = (await tx.get(this.db.collection(C.USUARIOS).doc(c.companyUid))).data();
    const amounts = settlementAmounts(c,payment ?? null); const blockers: string[] = [];
    if (!payment || payment.status !== 'approved' || payment.refundedMinor !== 0) blockers.push('Falta un cobro aprobado sin devoluciones ni contracargos.');
    if (payment?.netReceivedMinor == null) blockers.push('Falta confirmar el neto acreditado por Mercado Pago.');
    if (!c.professionalCompletedAt || !c.clientApprovedAt) blockers.push('Faltan las dos confirmaciones del trabajo.');
    if (c.dispute) blockers.push('El reclamo requiere revision antes de cualquier liquidacion.');
    if (c.paymentReviewRequired) blockers.push('Existe otro cobro o una inconsistencia que debe conciliarse.');
    if (!account?.verified || account.currency !== c.breakdown.currency) blockers.push('Falta verificar titular, cuenta y moneda de destino.');
    if (pro?.usuarioId !== c.professionalUid || pro.activo === false) blockers.push('El profesional requiere verificacion de identidad.');
    if (amounts.shortageMinor !== null && amounts.shortageMinor > 0) blockers.push('El neto acreditado no cubre al profesional y la comision completa de OfiAI.');
    if (transfer) blockers.push('Ya existe una transferencia registrada para este trabajo.');
    return { jobId:c.id, professionalId:c.professionalId,professionalName:[pro?.nombre,pro?.apellido].filter(Boolean).join(' ') || 'Profesional',
      professionalUserId:c.professionalUid,clientName:String(client?.nombre ?? 'Contratante'),currency:c.breakdown.currency,minorDigits:c.breakdown.minorDigits,
      quoteMinor:c.breakdown.professionalMinor,commissionBps:c.breakdown.commissionBps,ofiaiFeeMinor:c.breakdown.commissionMinor,
      processingEstimatedMinor:c.breakdown.processingMinor,taxesEstimatedMinor:c.breakdown.taxMinor + c.breakdown.withholdingMinor,
      clientTotalMinor:c.breakdown.clientTotalMinor,paymentId:payment?.id ?? null,paymentStatus:payment?.status ?? 'unpaid',
      collectedMinor:hasConfirmedCollection(payment ?? null) ? payment!.amountMinor : null,
      netReceivedMinor:hasConfirmedCollection(payment ?? null) ? payment!.netReceivedMinor : null,...amounts,
      professionalTransferMinor:c.breakdown.professionalMinor,ofiaiNetEstimatedMinor:c.breakdown.platformNetEstimatedMinor,
      readyToTransfer:blockers.length===0,blockers,account,status:c.paymentReviewRequired || c.dispute || payment?.status === 'charged_back' ? 'REVIEW' : transfer ? 'MANUALLY_RECORDED' : blockers.length===0 ? 'READY' : 'PENDING',
      transfer:transfer ? { reference:transfer.reference,recordedAt:transfer.recordedAt,amountMinor:transfer.amountMinor,account:transfer.account,confirmation:'manual_record' } : null };
  }
  /** Bandeja acotada; exige permiso OWNER en servidor, no una etiqueta visible en React. */
  async overview(actor: FinancialActor): Promise<SettlementOverview> {
    return this.db.runTransaction(async tx => {
      await this.contracts.requireOwner(tx,actor);
      const docs = await tx.get(this.db.collection(P.contracts).orderBy('updatedAt','desc').limit(51));
      const items: SettlementRow[] = [];
      for (const doc of docs.docs.slice(0,50)) items.push(await this.row(tx,doc.data() as StoredProtectedContract));
      return { items,limit:50,hasMore:docs.size>50 };
    });
  }
  /** Registra una transferencia efectuada fuera de OfiAI; no afirma verificacion bancaria automatica. */
  async recordTransfer(actor: FinancialActor, jobId: string, key: string, accountVersion: number, reference: string): Promise<void> {
    await this.db.runTransaction(async tx => {
      await this.contracts.requireOwner(tx,actor,true);
      const c = (await tx.get(this.db.collection(P.contracts).doc(jobId))).data() as StoredProtectedContract | undefined;
      if (!c || [c.companyUid,c.professionalUid].includes(actor.uid)) throw new ApiError('Liquidacion no permitida.',403);
      const ref = this.db.collection(SETTLEMENT_COLLECTIONS.transfers).doc(jobId); const previous = (await tx.get(ref)).data();
      if (previous) { if (previous.key===key && previous.reference===reference && previous.actorUid===actor.uid && previous.account.version===accountVersion) return;
        throw new ApiError('Esta contratacion ya tiene una transferencia registrada.',409); }
      const row = await this.row(tx,c);
      if (!row.readyToTransfer || row.account?.version !== accountVersion) throw new ApiError('No se puede registrar la liquidacion: revisa cobro, comision, aprobaciones y cuenta.',409);
      const referenceRef = this.db.collection(SETTLEMENT_COLLECTIONS.references).doc(createHash('sha256').update(reference.toLowerCase()).digest('hex'));
      if ((await tx.get(referenceRef)).exists) throw new ApiError('Ese comprobante ya fue utilizado.',409);
      const transfer = { reference, recordedAt:new Date().toISOString(),amountMinor:row.professionalTransferMinor,
        account:row.account,confirmation:'manual_record',key,actorUid:actor.uid,ofiaiFeeMinor:row.ofiaiFeeMinor,paymentId:row.paymentId };
      tx.create(ref,transfer); tx.create(referenceRef,{ jobId });
      this.contracts.audit(tx,jobId,actor,'manual_transfer_recorded',null,{ professionalMinor:row.professionalTransferMinor,ofiaiFeeMinor:row.ofiaiFeeMinor,accountVersion },key);
    });
  }
  /** Reserva una sola creacion de preferencia; una respuesta incierta se recupera por referencia. */
  async checkout(actor: FinancialActor, id: string): Promise<{ create:boolean; url:string|null; reference:string; amountMinor:number }> {
    await this.contracts.read(id,actor);
    return this.db.runTransaction(async tx=>{
      const c = (await tx.get(this.db.collection(P.contracts).doc(id))).data() as StoredProtectedContract;
      if (actor.rol!=='empresa' || actor.uid!==c.companyUid || !c.acceptedAt || !c.breakdown.chargesVerified || c.breakdown.currency!=='ARS'
        || c.financialState!=='UNPAID' || c.dispute || c.paymentReviewRequired) throw new ApiError('Revisa el desglose aceptado, costos del proveedor y estado del trabajo antes de pagar.',409);
      const ref = this.db.collection(SETTLEMENT_COLLECTIONS.checkouts).doc(id); const previous = (await tx.get(ref)).data();
      if (previous && Date.parse(previous.createdAt)+86400000<Date.now()) throw new ApiError('El checkout vencio. Requiere conciliacion antes de emitir otro.',409);
      if (!previous) { tx.create(ref,{ reference:'ofiai-job:' + id,createdAt:new Date().toISOString(),status:'creating' });
        this.contracts.audit(tx,id,actor,'checkout_requested',null,{ totalMinor:c.breakdown.clientTotalMinor },randomUUID()); }
      return { create:!previous,url:previous?.url ?? null,reference:'ofiai-job:' + id,amountMinor:c.breakdown.clientTotalMinor };
    });
  }
  /** Se conserva el checkout autorizado; no se confunde con un pago acreditado. */
  async saveCheckout(id: string, url: string, preferenceId: string, collectorId: string): Promise<void> {
    await this.db.runTransaction(async tx=>{
      const ref=this.db.collection(SETTLEMENT_COLLECTIONS.checkouts).doc(id); const old=(await tx.get(ref)).data();
      if (!old || (old.preferenceId && old.preferenceId!==preferenceId)) throw new ApiError('Checkout incompatible.',409);
      tx.update(ref,{ url,preferenceId,collectorId,status:'ready' });
    });
  }
  /** Persiste solo datos verificados por la API del proveedor y aplica monotonicidad temporal. */
  async applyPayment(receipt: ContractPaymentReceipt, collectorId: string): Promise<void> {
    await this.db.runTransaction(async tx=>{
      const contractRef=this.db.collection(P.contracts).doc(receipt.contractId);
      const c=(await tx.get(contractRef)).data() as StoredProtectedContract|undefined;
      const checkout=(await tx.get(this.db.collection(SETTLEMENT_COLLECTIONS.checkouts).doc(receipt.contractId))).data();
      const ref=this.db.collection(SETTLEMENT_COLLECTIONS.receipts).doc(receipt.contractId); const previous=(await tx.get(ref)).data() as ContractPaymentReceipt|undefined;
      if (!c || !checkout || checkout.collectorId!==collectorId || receipt.currency!==c.breakdown.currency || receipt.amountMinor!==c.breakdown.clientTotalMinor)
        throw new ApiError('El cobro no corresponde al acuerdo ni a la cuenta receptora.',409);
      if (previous && previous.id!==receipt.id && previous.status==='approved' && receipt.status==='approved') {
        const duplicateRef=ref.collection('duplicates').doc(receipt.id);
        if((await tx.get(duplicateRef)).exists)return;
        tx.update(contractRef,{ paymentReviewRequired:true });
        tx.create(duplicateRef,receipt);
        this.contracts.audit(tx,c.id,null,'duplicate_payment_detected',previous.id,receipt.id,receipt.id);return;
      }
      if (previous && previous.id!==receipt.id && !['rejected','cancelled'].includes(previous.status)) return;
      if (previous && previous.id===receipt.id && Date.parse(previous.updatedAt)>=Date.parse(receipt.updatedAt)) return;
      if (previous && previous.id===receipt.id && (receipt.refundedMinor<previous.refundedMinor || previous.status==='charged_back')) return;
      tx.set(ref,receipt);
      const financialState=receipt.status==='charged_back' ? 'CHARGEBACK' : receipt.status==='refunded' ? 'REFUNDED'
        : receipt.refundedMinor>0 ? 'PARTIALLY_REFUNDED' : receipt.status==='approved' ? 'PAID' : ['rejected','cancelled'].includes(receipt.status) ? 'UNPAID' : 'PAYMENT_PENDING';
      tx.update(contractRef,{ financialState,refundedMinor:receipt.refundedMinor,revision:c.revision+1,updatedAt:new Date().toISOString() });
      this.contracts.audit(tx,c.id,null,'payment_reconciled',previous?.status ?? null,{ status:receipt.status,amountMinor:receipt.amountMinor,netReceivedMinor:receipt.netReceivedMinor },receipt.id + ':' + receipt.updatedAt);
    });
  }
}
export const settlementRepository = new SettlementRepository();
