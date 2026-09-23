/**
 * @archivo tracing.ts
 * @descripcion Trazabilidad distribuida para OfiAI en Google Cloud.
 * @modulo Monitoring
 */
import { randomUUID } from 'crypto';
import { logger } from '../config/logger';

export interface SpanOfiAI {
  traceId: string;
  nombre: string;
  inicio: number;
  atributos?: Record<string, unknown>;
}

/**
 * Inicializa la trazabilidad base del proceso.
 */
export const configurarTracing = (): void => {
  logger.info('Tracing base inicializado.', {
    servicio: 'ofiai-backend',
    proveedor: 'interno',
  });
};

/**
 * Crea un span simple para correlacionar operaciones en logs.
 */
export const iniciarSpan = (nombre: string, atributos?: Record<string, unknown>): SpanOfiAI => {
  return {
    traceId: randomUUID(),
    nombre,
    inicio: Date.now(),
    atributos,
  };
};

/**
 * Finaliza un span y registra su duración.
 */
export const finalizarSpan = (span: SpanOfiAI): void => {
  logger.debug('Span finalizado.', {
    traceId: span.traceId,
    nombre: span.nombre,
    duracionMs: Date.now() - span.inicio,
    atributos: span.atributos,
  });
};
