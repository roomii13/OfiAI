/**
 * @archivo health.ts
 * @descripcion Endpoint y lógica de health check para OfiAI en Google Cloud Run.
 * Verifica el estado de todos los servicios críticos del sistema.
 * @modulo Monitoring
 */
import { Request, Response } from 'express';
import { obtenerReadinessProduccion } from '../config/productionReadiness';

export interface EstadoServicio {
  nombre: string;
  estado: 'operacional' | 'degradado' | 'caido';
  latencia?: number;
  mensaje?: string;
}

export interface RespuestaHealth {
  estado: 'saludable' | 'degradado' | 'critico';
  version: string;
  timestamp: string;
  servicios: EstadoServicio[];
  uptimeSegundos: number;
}

/**
 * Handler del endpoint GET /health
 * Expone el estado básico del proceso.
 */
export const healthCheck = async (_req: Request, res: Response): Promise<void> => {
  const readiness = obtenerReadinessProduccion();
  const respuesta: RespuestaHealth = {
    estado: readiness.estado,
    version: process.env.API_VERSION || 'v1',
    timestamp: new Date().toISOString(),
    servicios: readiness.servicios,
    uptimeSegundos: process.uptime(),
  };
  res.status(readiness.estado === 'critico' ? 503 : 200).json(respuesta);
};

/**
 * Handler del endpoint GET /health/liveness.
 * Confirma que el proceso HTTP está vivo.
 */
export const livenessCheck = async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    estado: 'operacional',
    servicio: 'OfiAI Backend',
    version: process.env.API_VERSION || 'v1',
    timestamp: new Date().toISOString(),
    uptimeSegundos: process.uptime(),
  });
};

/**
 * Handler del endpoint GET /health/readiness.
 * Informa si la configuración necesaria está presente sin exponer secretos.
 */
export const readinessCheck = async (_req: Request, res: Response): Promise<void> => {
  const readiness = obtenerReadinessProduccion();

  res.status(readiness.estado === 'critico' ? 503 : 200).json({
    ...readiness,
    timestamp: new Date().toISOString(),
  });
};
