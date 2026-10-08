/** @archivo reviews.d.ts @descripcion Resenas verificadas por contratacion finalizada, sin identidades privadas. */
export interface ReviewInput {
  calificacion: number;
  comentario: string;
  calificacionesDetalladas?: { puntualidad: number; calidadTrabajo: number; comunicacion: number };
}
/** Resena publica acotada del participante, con confirmacion del trabajo en servidor. */
export interface JobReview extends ReviewInput {
  id: string; trabajoId: string; profesionalId: string; verifiedJob: true; createdAt: string;
}
/** Estado de la evaluacion, accesible unicamente por los participantes. */
export interface JobReviewState { canReview: boolean; review: JobReview | null }
