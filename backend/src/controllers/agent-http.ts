/** @archivo agent-http.ts @descripcion Adaptacion HTTP acotada para los nuevos casos de uso. */
import type { Response, NextFunction } from 'express';
import type { RequestAutenticada } from '../middleware/auth.middleware';
import type { AgentActor } from '../models/agent.model';
import { ApiError } from '../middleware/error.middleware';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
/** Normaliza fallos y no devuelve trazas, claves ni respuestas de proveedores. */
export function agentHttp(action: (actor: AgentActor, req: RequestAutenticada) => Promise<unknown>) {
  return async (req: RequestAutenticada, res: Response, _next: NextFunction): Promise<void> => {
    try {
      if (!req.usuario) throw new ApiError('Inicia sesion para continuar.', 401);
      res.json({ exito: true, datos: await action(req.usuario, req) });
    } catch (error) {
      const status = error instanceof ApiError ? error.codigoEstado : error instanceof ZodError ? 400 : 503;
      if (status >= 500) logger.warn('Operacion de agente no disponible.', { route: req.route?.path, status });
      res.status(status).json({ exito: false, mensaje: error instanceof ApiError ? error.message
        : status === 400 ? 'Datos invalidos.' : 'No pudimos completar la operacion. Intenta nuevamente.' });
    }
  };
}
