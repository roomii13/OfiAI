/** @archivo review.service.ts @descripcion Casos de uso de evaluacion de trabajos reales, nunca de datos libres del cliente. */
import type { AgentActor } from '../models/agent.model';
import { reviewRepository, type ReviewRepository } from '../repositories/review.repository';
import { matchingIdSchema } from '../validators/matching.validator';
import { reviewSchema } from '../validators/review.validator';
import { ApiError } from '../middleware/error.middleware';

/** Orquesta validacion y persistencia sin acoplar la API a Firestore. */
export class ReviewService {
  /** Permite probar el servicio con un repositorio conectado al emulador. */
  constructor(private readonly repository: ReviewRepository = reviewRepository) {}
  /** Evita que administracion o un ID manipulado se atribuyan una contratacion. */
  private validate(jobId: string, actor: AgentActor): void {
    matchingIdSchema.parse(jobId);
    if (!['empresa', 'profesional'].includes(actor.rol)) throw new ApiError('Solo los participantes pueden consultar la evaluacion.', 403);
  }
  /** Devuelve evaluacion y permiso efectivo. */
  get(jobId: string, actor: AgentActor) {
    this.validate(jobId, actor);
    return this.repository.get(jobId, actor);
  }
  /** El contratante evalua una unica vez despues de confirmar el trabajo. */
  create(jobId: string, actor: AgentActor, body: unknown) {
    this.validate(jobId, actor);
    if (actor.rol !== 'empresa') throw new ApiError('Solo el contratante puede evaluar este trabajo.', 403);
    return this.repository.create(jobId, actor, reviewSchema.parse(body));
  }
}
export const reviewService = new ReviewService();
