/**
 * @archivo matching.controller.ts
 * @descripcion Adaptadores HTTP del matching; toda la logica pertenece al servicio.
 */
import type { Response, NextFunction } from 'express';
import type { RequestAutenticada } from '../middleware/auth.middleware';
import { ApiError } from '../middleware/error.middleware';
import { matchingService } from '../services/matching.service';
/** Controlador de acciones autenticadas de una empresa. */
class MatchingController {
  /** Despacha una accion conservando el contrato estandar de la API. */
  handle(action: 'execute' | 'get' | 'profile' | 'select' | 'view') {
    return async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.usuario) throw new ApiError('Inicia sesion para continuar.', 401);
        const { uid, rol } = req.usuario;
        const id = String(req.params.id ?? '');
        const professionalId = String(req.params.professionalId ?? '');
        const datos = action === 'execute' ? await matchingService.execute(id, uid, rol)
          : action === 'get' ? await matchingService.get(id, uid, rol)
          : action === 'profile' ? await matchingService.profile(id, professionalId, uid, rol)
          : action === 'select' ? await matchingService.select(id, professionalId, req.body.runId, uid, rol)
          : await matchingService.viewed(id, req.body.runId, uid, rol);
        res.json({ exito: true, datos: datos ?? null });
      } catch (error) { next(error); }
    };
  }
}
export const matchingController = new MatchingController();

