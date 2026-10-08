/** @archivo review.repository.ts @descripcion Resena unica por Job, agregados atomicos y ownership revalidado. */
import { createHash } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { firestore } from '../integrations/firebase/admin';
import { COLECCIONES as C } from '../database/firestore/collections';
import { ApiError } from '../middleware/error.middleware';
import type { Trabajo } from '../models/Job';
import type { Empresa } from '../models/Company';
import type { Profesional } from '../models/Professional';
import type { StoredCoordinator } from '../models/coordinator.model';
import type { AgentActor } from '../models/agent.model';
import type { JobReview, JobReviewState, ReviewInput } from '../../../shared/reviews';

/** Proyecta campos revisados explicitamente; no publica UIDs ni metadatos de auditoria. */
function publicReview(data?: Record<string, unknown>): JobReview | null {
  if (!data) return null;
  return { id: data.id as string, trabajoId: data.trabajoId as string,
    profesionalId: data.profesionalId as string, verifiedJob: true, createdAt: data.createdAt as string,
    calificacion: data.calificacion as number, comentario: data.comentario as string,
    ...(data.calificacionesDetalladas ? { calificacionesDetalladas: data.calificacionesDetalladas as ReviewInput['calificacionesDetalladas'] } : {}) };
}

/** Firestore inyectable para probar concurrencia sin afectar datos productivos. */
export class ReviewRepository {
  /** Reutiliza la base y colecciones existentes. */
  constructor(private readonly db: Firestore = firestore) {}

  /** La identidad debe coincidir con el propietario y con la coordinacion real. */
  private async context(tx: Transaction, jobId: string, actor: AgentActor) {
    const ref = this.db.collection(C.TRABAJOS).doc(jobId);
    const job = (await tx.get(ref)).data() as Trabajo | undefined;
    if (!job) throw new ApiError('Trabajo no encontrado.', 404);
    const company = (await tx.get(this.db.collection(C.EMPRESAS).doc(job.empresaId))).data() as Empresa | undefined;
    const workflow = (await tx.get(ref.collection(C.COORDINATOR).doc('current'))).data() as StoredCoordinator | undefined;
    const professional = workflow ? (await tx.get(this.db.collection(C.PROFESIONALES).doc(workflow.professionalId))).data() as Profesional | undefined : undefined;
    const owner = actor.rol === 'empresa' && company?.usuarioId === actor.uid && company.activo !== false;
    const worker = actor.rol === 'profesional' && workflow?.professionalUid === actor.uid && professional?.usuarioId === actor.uid;
    if (!owner && !worker) throw new ApiError('Trabajo no encontrado.', 404);
    const completed = job.estado === 'completado' && workflow?.state === 'COMPLETED'
      && workflow.companyUid === company?.usuarioId && workflow.professionalUid === professional?.usuarioId
      && job.profesionalAsignadoId === workflow.professionalId;
    return { job, workflow, professional, owner, completed };
  }

  /** Consulta de participantes sin que una pantalla habilite una resena ajena. */
  async get(jobId: string, actor: AgentActor): Promise<JobReviewState> {
    return this.db.runTransaction(async tx => {
      const context = await this.context(tx, jobId, actor);
      const data = (await tx.get(this.db.collection(C.RESENAS).doc('job_' + jobId))).data();
      return { canReview: Boolean(context.owner && context.completed && !data), review: publicReview(data) };
    });
  }

  /** Escribe resena, reputacion y evento en un commit; un reintento no suma estrellas. */
  async create(jobId: string, actor: AgentActor, input: ReviewInput): Promise<JobReviewState> {
    return this.db.runTransaction(async tx => {
      const { workflow, professional, owner, completed } = await this.context(tx, jobId, actor);
      if (!owner) throw new ApiError('Solo el contratante puede evaluar este trabajo.', 403);
      if (!completed || !workflow || !professional) throw new ApiError('Confirma la finalizacion del trabajo antes de calificar.', 409);
      if (actor.uid === professional.usuarioId) throw new ApiError('No puedes evaluar tu propio perfil profesional.', 403);
      const ref = this.db.collection(C.RESENAS).doc('job_' + jobId);
      const previous = (await tx.get(ref)).data();
      const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
      if (previous) {
        if (previous.autorId !== actor.uid || previous.fingerprint !== fingerprint) throw new ApiError('Este trabajo ya fue evaluado.', 409);
        return { canReview: false, review: publicReview(previous) };
      }
      const outboxRef = this.db.collection(C.COORDINATOR_OUTBOX).doc(workflow.id + '_completed');
      const outbox = await tx.get(outboxRef);
      const count = professional.totalResenas ?? 0;
      const sum = (professional.sumaCalificaciones ?? (professional.calificacionPromedio ?? 0) * count) + input.calificacion;
      const now = new Date();
      const data = { ...input, id: ref.id, trabajoId: jobId, profesionalId: professional.id,
        autorId: actor.uid, destinatarioId: professional.usuarioId, tipoResena: 'empresa_a_profesional',
        visible: true, verifiedJob: true, workflowId: workflow.id, fingerprint,
        fechaCreacion: now, createdAt: now.toISOString() };
      tx.create(ref, data);
      tx.update(this.db.collection(C.PROFESIONALES).doc(professional.id), {
        totalResenas: count + 1, sumaCalificaciones: sum, calificacionPromedio: sum / (count + 1), fechaActualizacion: now,
      });
      if (outbox.exists) tx.update(outboxRef, { status: 'review_received', reviewId: ref.id, updatedAt: now.toISOString() });
      tx.create(this.db.collection(C.ANALYTICS_EVENTOS).doc(ref.id + '_reviewed'), {
        id: ref.id + '_reviewed', tipo: 'professional_rated', fecha: now,
        metadata: { rating: input.calificacion, verifiedJob: true },
      });
      return { canReview: false, review: publicReview(data) };
    });
  }
}
export const reviewRepository = new ReviewRepository();
