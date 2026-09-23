/**
 * @archivo job-created.event.ts
 * @descripcion Evento disparado cuando una empresa publica un nuevo trabajo en OfiAI.
 * Desencadena el flujo de matching automático con IA.
 * @modulo Events
 */
import { logger } from '../config/logger';
import { matchingWorker } from '../workers/matching.worker';

export interface EventoTrabajoCreado {
  trabajoId: string;
  empresaId: string;
  categoria: string;
  ciudad: string;
  presupuesto?: { min?: number; max?: number; moneda: string };
  timestamp: Date;
}

/**
 * Publica el evento de trabajo creado en el canal interno actual.
 */
export const publicarEventoTrabajoCreado = async (evento: EventoTrabajoCreado): Promise<void> => {
  logger.info('Evento de trabajo creado publicado.', {
    tipo: 'job.created',
    trabajoId: evento.trabajoId,
  });
  try {
    await matchingWorker(evento.trabajoId, false);
  } catch {
    // El Job ya esta confirmado: un proveedor externo no puede deshacer su publicacion.
    logger.warn('Matching pendiente de reintento desde el Job.', { trabajoId: evento.trabajoId });
  }
};
