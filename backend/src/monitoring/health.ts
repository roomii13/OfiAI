/**
 * @archivo health.ts
 * @descripcion Endpoint y lógica de health check para OfiAI en Google Cloud Run.
 * Verifica el estado de todos los servicios críticos del sistema.
 * @modulo Monitoring
 */
import { Request, Response } from 'express';

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
 * TODO: Verificar conexión a Firestore
 * TODO: Verificar disponibilidad de Gemini API
 * TODO: Verificar conexión a Redis (si está habilitado)
 * TODO: Verificar estado de Stripe webhooks
 */
export const healthCheck = async (_req: Request, res: Response): Promise<void> => {
  const respuesta: RespuestaHealth = {
    estado: 'saludable',
    version: process.env.API_VERSION || 'v1',
    timestamp: new Date().toISOString(),
    servicios: [],             // TODO: Agregar estado de cada servicio
    uptimeSegundos: process.uptime(),
  };
  res.status(200).json(respuesta);
};
