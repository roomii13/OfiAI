/** @archivo coordinator.controller.ts @descripcion Adaptador HTTP del workflow bilateral. */
import type { Response, NextFunction } from 'express';
import type { RequestAutenticada } from '../middleware/auth.middleware';
import { ApiError } from '../middleware/error.middleware';
import { coordinatorService } from '../services/coordinator.service';
import { logger } from '../config/logger';
import { metricas } from '../monitoring/metrics';
/** No acepta identidad, estado objetivo ni permisos desde el cuerpo del cliente. */
class CoordinatorController {
  /** Despacha los casos de uso utilizando el usuario verificado por Firebase. */
  handle(action: 'get' | 'start' | 'command' | 'list') {
    return async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
      const startedAt = Date.now();
      try {
        if (!req.usuario) throw new ApiError('Inicia sesion para continuar.', 401);
        const { uid, rol } = req.usuario; const id = String(req.params.id ?? '');
        const datos = action === 'list' ? await coordinatorService.list(uid, rol, req.query)
          : action === 'get' ? await coordinatorService.get(id, uid, rol)
          : await coordinatorService[action](id, uid, rol, req.body);
        res.json({ exito: true, datos });
      } catch (error) {
        metricas.incrementarContador(error instanceof ApiError && error.codigoEstado < 500 ? 'coordinator_rejected' : 'coordinator_failed');
        if (!(error instanceof ApiError)) logger.warn('Operacion de coordinacion no disponible.', { action });
        next(error);
      } finally { metricas.observarLatencia('coordinator_' + action, Date.now() - startedAt); }
    };
  }
}
export const coordinatorController = new CoordinatorController();
