/**
 * @archivo professional-rated.event.ts
 * @descripcion Evento disparado cuando un profesional recibe una nueva calificación.
 * @modulo Events
 */
export interface EventoProfesionalCalificado {
  profesionalId: string;
  trabajoId: string;
  calificacion: number;
  timestamp: Date;
}

export const publicarEventoProfesionalCalificado = async (_evento: EventoProfesionalCalificado): Promise<void> => {
  // TODO: Disparar reputation.worker.ts
  // TODO: Actualizar ranking en resultados de búsqueda
  // TODO: Notificar al profesional sobre la nueva calificación
};
