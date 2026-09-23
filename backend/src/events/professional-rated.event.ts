/**
 * @archivo professional-rated.event.ts
 * @descripcion Evento disparado cuando un profesional recibe una nueva calificación.
 * @modulo Events
 */
import { logger } from '../config/logger';

export interface EventoProfesionalCalificado {
  profesionalId: string;
  trabajoId: string;
  calificacion: number;
  timestamp: Date;
}

/**
 * Publica el evento de calificación profesional en el canal interno actual.
 */
export const publicarEventoProfesionalCalificado = async (evento: EventoProfesionalCalificado): Promise<void> => {
  logger.info('Evento de profesional calificado publicado.', {
    tipo: 'professional.rated',
    ...evento,
  });
};
