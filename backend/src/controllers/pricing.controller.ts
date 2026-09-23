/** @archivo pricing.controller.ts @descripcion Adaptador HTTP del servicio de pricing. */
import type { Response, NextFunction } from 'express';
import type { RequestAutenticada } from '../middleware/auth.middleware';
import { ApiError } from '../middleware/error.middleware';
import { pricingService } from '../services/pricing.service';
/** Controlador delgado con el contrato habitual de OfiAI. */
class PricingController {
  /** Delega cada accion usando exclusivamente identidad autenticada. */
  handle(action: 'get' | 'execute' | 'inputs' | 'quote') {
    return async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.usuario) throw new ApiError('Inicia sesion para continuar.', 401);
        const { uid, rol } = req.usuario; const id = String(req.params.id ?? '');
        const datos = action === 'inputs' || action === 'quote'
          ? await pricingService[action](id, uid, rol, req.body) : await pricingService[action](id, uid, rol);
        res.json({ exito: true, datos });
      } catch (error) { next(error); }
    };
  }
}
export const pricingController = new PricingController();
