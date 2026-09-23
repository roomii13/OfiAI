/**
 * @archivo company-created.event.ts
 * @descripcion Evento disparado cuando una empresa se registra en OfiAI.
 * @modulo Events
 */
import { logger } from '../config/logger';

export interface EventoEmpresaCreada {
  empresaId: string;
  usuarioId: string;
  pais: string;
  timestamp: Date;
}

/**
 * Publica el evento de empresa creada en el canal interno actual.
 */
export const publicarEventoEmpresaCreada = async (evento: EventoEmpresaCreada): Promise<void> => {
  logger.info('Evento de empresa creada publicado.', {
    tipo: 'company.created',
    ...evento,
  });
};
