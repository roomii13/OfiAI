/** @archivo pricing.routes.ts @descripcion Rutas anidadas con autenticacion, rol y limites existentes. */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { verificarAutenticacion } from '../middleware/auth.middleware';
import { requerirRol } from '../middleware/role.middleware';
import { limitadorIA } from '../middleware/rateLimit.middleware';
import { validarBody } from '../middleware/validation.middleware';
import { pricingCommand, pricingInputCommand, pricingQuoteCommand } from '../validators/pricing.validator';
import { pricingController } from '../controllers/pricing.controller';
import { ApiError } from '../middleware/error.middleware';
export const pricingRoutes = Router({ mergeParams: true });
pricingRoutes.use(verificarAutenticacion, requerirRol('empresa'));
pricingRoutes.get('/', pricingController.handle('get'));
pricingRoutes.post('/', limitadorIA, validarBody(pricingCommand), pricingController.handle('execute'));
pricingRoutes.put('/inputs', limitadorIA, validarBody(pricingInputCommand), pricingController.handle('inputs'));
pricingRoutes.post('/quotes', limitadorIA, validarBody(pricingQuoteCommand), pricingController.handle('quote'));
/** Nunca expone mensajes internos de Firestore o Gemini. */
pricingRoutes.use((error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  res.status(error instanceof ApiError ? error.codigoEstado : 503).json({ exito: false,
    mensaje: error instanceof ApiError ? error.message : 'No pudimos completar la estimacion. Intenta nuevamente.' });
});
