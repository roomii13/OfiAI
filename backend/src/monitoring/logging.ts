/**
 * @archivo logging.ts
 * @descripcion Configuración avanzada de logging para producción en Google Cloud.
 * @modulo Monitoring
 */
import { logger } from '../config/logger';

/**
 * Inicializa campos base de logging estructurado para el proceso actual.
 */
export const configurarLogging = (): void => {
  logger.info('Logging estructurado inicializado.', {
    servicio: 'ofiai-backend',
    entorno: process.env.NODE_ENV ?? 'development',
  });
};
