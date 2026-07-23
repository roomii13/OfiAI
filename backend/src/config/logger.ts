/**
 * @archivo logger.ts
 * @descripcion Sistema de logging estructurado para OfiAI Backend basado en Winston.
 * Totalmente compatible con Google Cloud Logging en entornos de producción y formateado interactivo para desarrollo.
 * @modulo Config
 */

import { createLogger, format, transports, Logger } from 'winston';
import { env } from './env';

const { combine, timestamp, printf, colorize, errors, json } = format;

/**
 * Mapeo de niveles de log de Winston a la severidad reconocida por Google Cloud Logging.
 */
const mapeoSeveridadGCP: Record<string, string> = {
  error: 'ERROR',
  warn: 'WARNING',
  info: 'INFO',
  http: 'INFO',
  verbose: 'DEBUG',
  debug: 'DEBUG',
  silly: 'DEFAULT',
};

/**
 * Formato de log personalizado para consola en entornos de desarrollo.
 */
const formatoConsolaDesarrollo = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  const detalleError = stack ? `\n${stack}` : '';
  return `[${timestamp}] ${level}: ${message}${metaString}${detalleError}`;
});

/**
 * Formateador personalizado para Google Cloud Logging en producción.
 * Añade la clave 'severity' requerida por GCP y conserva contexto adicional.
 */
const formatoGCP = format((info) => {
  info.severity = mapeoSeveridadGCP[info.level] || 'INFO';
  return info;
});

/**
 * Creación de la instancia principal del Logger de Winston para OfiAI.
 */
export const logger: Logger = createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    env.NODE_ENV === 'production'
      ? combine(formatoGCP(), json())
      : combine(colorize(), formatoConsolaDesarrollo)
  ),
  defaultMeta: { servicio: 'ofiai-backend', ambiente: env.NODE_ENV },
  transports: [
    new transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
  exitOnError: false,
});

/**
 * Utilidad auxiliar para registrar eventos con contexto estructurado.
 * @param mensaje - Mensaje principal del evento.
 * @param meta - Metadatos adicionales para depuración o auditoría.
 */
export const logInfo = (mensaje: string, meta?: Record<string, unknown>): void => {
  logger.info(mensaje, meta);
};

/**
 * Utilidad auxiliar para registrar errores con metadatos estructurados.
 * @param mensaje - Descripción del error.
 * @param error - Instancia de Error u objeto de detalle.
 * @param meta - Contexto adicional de la operación.
 */
export const logError = (mensaje: string, error?: unknown, meta?: Record<string, unknown>): void => {
  const stack = error instanceof Error ? error.stack : undefined;
  logger.error(mensaje, { error, stack, ...meta });
};
