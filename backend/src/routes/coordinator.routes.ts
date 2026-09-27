/** @archivo coordinator.routes.ts @descripcion Acceso autenticado, limitado y con errores seguros a coordinacion. */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { verificarAutenticacion } from '../middleware/auth.middleware';
import { requerirRol } from '../middleware/role.middleware';
import { limitadorIA } from '../middleware/rateLimit.middleware';
import { validarBody } from '../middleware/validation.middleware';
import { coordinatorStartSchema, coordinatorCommandSchema } from '../validators/coordinator.validator';
import { coordinatorController } from '../controllers/coordinator.controller';
import { ApiError } from '../middleware/error.middleware';
/** Nunca expone errores de Firestore o datos internos del workflow. */
function safeError(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  res.status(error instanceof ApiError ? error.codigoEstado : 503).json({ exito: false,
    mensaje: error instanceof ApiError ? error.message : 'No pudimos actualizar la coordinacion. Tus acuerdos siguen guardados.' });
}
export const coordinatorRoutes = Router({ mergeParams: true });
coordinatorRoutes.use(verificarAutenticacion, requerirRol('empresa', 'profesional'));
coordinatorRoutes.get('/', coordinatorController.handle('get'));
coordinatorRoutes.post('/', limitadorIA, validarBody(coordinatorStartSchema), coordinatorController.handle('start'));
coordinatorRoutes.post('/commands', limitadorIA, validarBody(coordinatorCommandSchema), coordinatorController.handle('command'));
coordinatorRoutes.use(safeError);
export const coordinatorListRoutes = Router();
coordinatorListRoutes.use(verificarAutenticacion, requerirRol('empresa', 'profesional'));
coordinatorListRoutes.get('/', coordinatorController.handle('list'));
coordinatorListRoutes.use(safeError);
