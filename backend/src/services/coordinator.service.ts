/** @archivo coordinator.service.ts @descripcion Casos de uso: empresa y profesional coordinan desde sus identidades autenticadas. */
import { coordinatorRepository } from '../repositories/coordinator.repository';
import { coordinatorAgent } from '../ai/agents/coordinator.agent';
import { pricingService } from './pricing.service';
import { coordinatorStartSchema, coordinatorCommandSchema, coordinatorQuerySchema } from '../validators/coordinator.validator';
import { matchingIdSchema } from '../validators/matching.validator';
import { publicMatchingJob, matchingText } from '../domain/matching/matching';
import { ApiError } from '../middleware/error.middleware';
import { coordinatorWorker } from '../workers/coordinator.worker';
import type { RolUsuario } from '../models/User';
import type { CoordinatorRole, CoordinatorView, CoordinatorWorkflow, CoordinatorList } from '../models/coordinator.model';
/** Coordina sin convertir sugerencias IA en acuerdos comerciales. */
export class CoordinatorService {
  /** Roles y parametros se verifican tambien fuera de HTTP, para workers y pruebas. */
  private role(id: string, role: RolUsuario): CoordinatorRole {
    if (role !== 'empresa' && role !== 'profesional') throw new ApiError('Solo los participantes pueden coordinar un trabajo.', 403);
    if (!matchingIdSchema.safeParse(id).success) throw new ApiError('Identificador invalido.', 400);
    return role;
  }
  /** Proyeccion publica explicita; nunca filtra huellas, UIDs o claves de idempotencia. */
  async get(id: string, uid: string, role: RolUsuario): Promise<CoordinatorView> {
    const participant = this.role(id, role);
    const { job, workflow: w } = await coordinatorRepository.read(id, uid, participant);
    const workflow: CoordinatorWorkflow | null = w ? {
      id: w.id, jobId: w.jobId, companyId: w.companyId, professionalId: w.professionalId,
      professionalName: w.professionalName, state: w.state, revision: w.revision,
      matchingRunId: w.matchingRunId, pricingEstimateId: w.pricingEstimateId, pricingInsufficient: w.pricingInsufficient,
      offer: w.offer, schedule: w.schedule, completionRequested: w.completionRequested,
      createdAt: w.createdAt, updatedAt: w.updatedAt,
      charges: w.charges ?? null,
    } : null;
    return { job: w && participant === 'profesional' ? w.jobSnapshot : publicMatchingJob(job), workflow, role: participant,
      advice: workflow ? coordinatorAgent.decide(workflow, participant) : {
        message: 'Revisa Pricing y selecciona un profesional para iniciar la coordinacion.', waitingFor: 'empresa', actions: [],
      }, history: w ? await coordinatorRepository.history(id, w.id) : [] };
  }
  /** Revalida Pricing antes del inicio; permite falta de evidencia para pedir una oferta real. */
  async start(id: string, uid: string, role: RolUsuario, body: unknown): Promise<CoordinatorView> {
    if (this.role(id, role) !== 'empresa') throw new ApiError('La empresa debe iniciar la coordinacion.', 403);
    const parsed = coordinatorStartSchema.safeParse(body);
    if (!parsed.success) throw new ApiError('Confirma que la estimacion no es un presupuesto aceptado.', 400);
    const existing = await coordinatorRepository.read(id, uid, 'empresa');
    if (await coordinatorRepository.started(id, uid, parsed.data.idempotencyKey)) return this.get(id, uid, role);
    if (!existing.job.matchingSelection) throw new ApiError('Selecciona un profesional antes de coordinar.', 409);
    const pricing = await pricingService.get(id, uid, role);
    if (pricing.stale || !pricing.result) throw new ApiError('Actualiza Pricing antes de iniciar la coordinacion.', 409);
    await coordinatorRepository.start(id, uid, parsed.data, pricing.result.id, existing.job.matchingSelection);
    return this.get(id, uid, role);
  }
  /** Cada efecto exige un comando valido, revision e identidad del actor. */
  async command(id: string, uid: string, role: RolUsuario, body: unknown): Promise<CoordinatorView> {
    const participant = this.role(id, role);
    const parsed = coordinatorCommandSchema.safeParse(body);
    if (!parsed.success) throw new ApiError('Revisa los datos del presupuesto, horario o accion.', 400);
    const command = parsed.data;
    if (command.note) command.note = matchingText(command.note, 500);
    if (command.quote) command.quote = { ...command.quote, label: matchingText(command.quote.label, 100), scope: matchingText(command.quote.scope, 400) };
    if (!coordinatorCommandSchema.safeParse(command).success) throw new ApiError('Describe los detalles sin datos privados o de contacto.', 400);
    await coordinatorRepository.command(id, uid, participant, command);
    if (command.action === 'contact') await coordinatorWorker(id);
    return this.get(id, uid, role);
  }
  /** Bandeja paginada de conversaciones reales del participante. */
  async list(uid: string, role: RolUsuario, query: unknown): Promise<CoordinatorList> {
    const participant = this.role('list', role); const parsed = coordinatorQuerySchema.safeParse(query);
    if (!parsed.success) throw new ApiError('Cursor invalido.', 400);
    return coordinatorRepository.list(uid, participant, parsed.data.cursor);
  }
}
export const coordinatorService = new CoordinatorService();
