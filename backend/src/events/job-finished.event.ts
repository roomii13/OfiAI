/**
 * @archivo job-finished.event.ts
 * @descripcion Evento disparado cuando un trabajo es marcado como completado.
 * Desencadena el flujo de calificación y actualización de reputación.
 * @modulo Events
 */
import { logger } from '../config/logger';

export interface EventoTrabajoFinalizado {
  trabajoId: string;
  empresaId: string;
  profesionalId: string;
  timestamp: Date;
}

/**
 * Publica el evento de trabajo finalizado en el canal interno actual.
 */
export const publicarEventoTrabajoFinalizado = async (evento: EventoTrabajoFinalizado): Promise<void> => {
  logger.info('Evento de trabajo finalizado publicado.', {
    tipo: 'job.finished',
    ...evento,
  });
};
