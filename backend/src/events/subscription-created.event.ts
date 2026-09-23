/**
 * @archivo subscription-created.event.ts
 * @descripcion Evento disparado cuando se activa una nueva suscripción en OfiAI.
 * @modulo Events
 */
import { logger } from '../config/logger';

export interface EventoSuscripcionCreada {
  suscripcionId: string;
  usuarioId: string;
  plan: 'gratuito' | 'profesional' | 'empresa';
  monto: number;
  moneda: string;
  timestamp: Date;
}

/**
 * Publica el evento de suscripción creada en el canal interno actual.
 */
export const publicarEventoSuscripcionCreada = async (evento: EventoSuscripcionCreada): Promise<void> => {
  logger.info('Evento de suscripción creada publicado.', {
    tipo: 'subscription.created',
    ...evento,
  });
};
