/** @archivo protected-contract.service.ts @descripcion Casos de uso autorizados, proyecciones publicas y puerto financiero cerrado por defecto. */
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ProtectedContractRepository, protectedContractRepository } from '../repositories/protected-contract.repository';
import { firebaseStorage } from '../integrations/firebase/admin';
import { ApiError } from '../middleware/error.middleware';
import { contractIdSchema, contractCommandSchema, contractPolicySchema, financialGrantSchema } from '../validators/protected-contract.validator';
import type { FinancialActor, StoredProtectedContract } from '../models/protected-contract.model';
import type { ProtectedContractView } from '../../../shared/protected-contract';
import { assistDispute } from '../ai/agents/dispute.agent';
import { metricas } from '../monitoring/metrics';
import { coordinatorRepository } from '../repositories/coordinator.repository';
import { env } from '../config/env';

/** Valida tambien invocaciones desde workers, no solo controladores HTTP. */
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value); if (!parsed.success) throw new ApiError('Revisa los datos de la solicitud.', 400); return parsed.data;
}
/** Importes, destinatario y operaciones siempre se derivan del expediente servidor. */
export class ProtectedContractService {
  /** Reutiliza el repositorio transaccional y no ejecuta operaciones financieras. */
  constructor(private readonly repo: ProtectedContractRepository = protectedContractRepository) {}
  /** Proyeccion explicita sin UID, permisos, huellas, referencias de pago ni rutas privadas. */
  private view(c: StoredProtectedContract): ProtectedContractView {
    return { id: c.id, workflowId: c.workflowId, quoteId: c.quoteId, revision: c.revision,
      workState: c.workState, financialState: c.financialState, breakdown: c.breakdown,
      acceptedAt: c.acceptedAt, professionalCompletedAt: c.professionalCompletedAt, clientApprovedAt: c.clientApprovedAt,
      dispute: c.dispute, refundedMinor: c.refundedMinor, updatedAt: c.updatedAt,
      collectionEnabled: env.CONTRACT_PAYMENTS_ENABLED && c.breakdown.chargesVerified && c.breakdown.currency === 'ARS' };
  }
  /** No crea contratos como efecto secundario de una consulta. */
  async get(id: string, actor: FinancialActor): Promise<ProtectedContractView | null> {
    parse(contractIdSchema,id);
    try { return this.view(await this.repo.read(id,actor)); }
    catch(error) {
      if (!(error instanceof ApiError) || error.codigoEstado!==404 || !['empresa','profesional'].includes(actor.rol)) throw error;
      await coordinatorRepository.read(id,actor.uid,actor.rol as 'empresa'|'profesional'); return null;
    }
  }
  /** Genera un snapshot desde el presupuesto real ya aceptado. */
  async prepare(id: string, actor: FinancialActor): Promise<ProtectedContractView> { return this.view(await this.repo.prepare(parse(contractIdSchema, id), actor)); }
  /** Validacion estricta excluye importes arbitrarios, roles y estado objetivo. */
  async command(id: string, actor: FinancialActor, body: unknown): Promise<ProtectedContractView> {
    return this.view(await this.repo.command(parse(contractIdSchema, id), actor, parse(contractCommandSchema, body)));
  }
  /** Bandeja de resolucion sin identidades privadas de las partes. */
  async list(actor: FinancialActor): Promise<ProtectedContractView[]> { return (await this.repo.list(actor)).map(c => this.view(c)); }
  /** Historial de mensajes y evidencias limitado y autorizado. */
  async entries(id: string, actor: FinancialActor) { return this.repo.entries(parse(contractIdSchema,id), actor); }
  /** Requiere permisos de auditoria del servidor. */
  async history(id: string, actor: FinancialActor) { return this.repo.history(parse(contractIdSchema,id), actor); }
  /** Una nueva version no recalcula contratos aceptados. */
  async policy(actor: FinancialActor, body: unknown): Promise<void> {
    const input = parse(z.object({ policy: contractPolicySchema, reason: z.string().trim().min(10).max(500) }).strict(), body);
    await this.repo.setPolicy(actor, input.policy, input.reason);
  }
  /** Lectura de configuracion sin efectos sobre contratos existentes. */
  async getPolicy(actor: FinancialActor,currency:string) { return this.repo.policy(actor,parse(z.enum(['ARS','USD','EUR','BRL','CLP','UYU','MXN','PEN','COP']),currency)); }
  /** La cuenta administradora debe existir; no eleva usuarios normales ni crea OWNER. */
  async grant(actor: FinancialActor, body: unknown): Promise<void> {
    const { reason, ...grant } = parse(financialGrantSchema, body); await this.repo.setGrant(actor, grant, reason);
  }
  /** Asistencia no vinculante. El modelo nunca recibe herramientas de escritura financiera. */
  async advice(id: string, actor: FinancialActor) {
    const c = await this.repo.read(parse(contractIdSchema,id), actor);
    if (!c.dispute) throw new ApiError('No existe un reclamo para analizar.',409);
    const entries = await this.repo.entries(id, actor); return assistDispute(actor,c,entries);
  }
  /** Archivos privados, inmutables y sin URLs publicas; magic bytes y limite antes de subir. */
  async uploadEvidence(id: string, actor: FinancialActor, body: unknown): Promise<{ id: string }> {
    parse(contractIdSchema,id); await this.repo.read(id,actor);
    const input = parse(z.object({ caption: z.string().trim().min(5).max(1000), mime: z.enum(['image/jpeg','image/png','application/pdf']),
      data: z.string().min(4).max(5600000).regex(/^[A-Za-z0-9+/]+={0,2}$/) }).strict(),body);
    const bytes = Buffer.from(input.data,'base64');
    const valid = input.mime === 'image/jpeg' ? bytes.subarray(0,3).equals(Buffer.from([255,216,255]))
      : input.mime === 'image/png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes.subarray(0,5).toString() === '%PDF-';
    if (!valid || bytes.length > 4*1024*1024) throw new ApiError('Archivo invalido o mayor a 4 MB.',400);
    const evidenceId = randomUUID(); const path = 'contract-evidence/' + id + '/' + evidenceId;
    const file = firebaseStorage.bucket().file(path);
    await file.save(bytes,{ resumable:false, contentType:input.mime, preconditionOpts:{ ifGenerationMatch:0 }, metadata:{ cacheControl:'private, no-store' } });
    try { await this.repo.addEvidence(id,actor,{ id:evidenceId,path,sha256:createHash('sha256').update(bytes).digest('hex'),mime:input.mime,size:bytes.length,caption:input.caption }); }
    catch (error) { await file.delete({ ignoreNotFound:true }).catch(() => metricas.incrementarContador('evidence_cleanup_pending')); throw error; }
    return { id:evidenceId };
  }
  /** Descarga autentica con integridad verificada; no devuelve un enlace reutilizable. */
  async downloadEvidence(id: string, actor: FinancialActor, evidenceId: string): Promise<Buffer> {
    parse(contractIdSchema,id); parse(z.string().uuid(),evidenceId);
    const evidence = await this.repo.evidence(id,actor,evidenceId);
    const [bytes] = await firebaseStorage.bucket().file(evidence.path).download();
    if (bytes.length !== evidence.size || createHash('sha256').update(bytes).digest('hex') !== evidence.sha256) throw new ApiError('No se pudo verificar la integridad de la evidencia.',409);
    return bytes;
  }
}
export const protectedContractService = new ProtectedContractService();
