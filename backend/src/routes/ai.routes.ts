/**
 * @archivo ai.routes.ts
 * @descripcion Rutas de IA para la API de OfiAI.
 * @modulo Routes
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { aiController } from '../controllers/ai.controller';
import { verificarAutenticacion } from '../middleware/auth.middleware';
import { requerirRol } from '../middleware/role.middleware';
import { validarBody } from '../middleware/validation.middleware';
import { limitadorIA } from '../middleware/rateLimit.middleware';
import { ApiError } from '../middleware/error.middleware';
import { intakeStartSchema, intakeMessageSchema, intakeConfirmSchema, intakeAbandonSchema } from '../models/intake.model';
import { logger } from '../config/logger';

const router = Router();
const intake = Router();

intake.post('/sessions', limitadorIA, validarBody(intakeStartSchema), aiController.intake('start'));
intake.get('/sessions', aiController.intake('list'));
intake.get('/sessions/:id', aiController.intake('get'));
intake.post('/sessions/:id/messages', limitadorIA, validarBody(intakeMessageSchema), aiController.intake('message'));
intake.post('/sessions/:id/confirm', validarBody(intakeConfirmSchema), aiController.intake('confirm'));
intake.post('/sessions/:id/abandon', validarBody(intakeAbandonSchema), aiController.intake('abandon'));
router.use('/intake', verificarAutenticacion, requerirRol('empresa'), intake);
/** Evita revelar stacks, prompts o respuestas internas incluso en desarrollo. */
router.use('/intake', (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  const known = error instanceof ApiError;
  const status = known ? error.codigoEstado : 503;
  logger.warn('Solicitud Intake no completada.', { status });
  res.status(status).json({ exito: false, mensaje: known ? error.message : 'No pudimos completar esta accion. Tu conversacion sigue guardada; intenta nuevamente.' });
});

/**
 * POST /api/v1/ai/matching
 * Ejecuta ranking inteligente de profesionales para un trabajo.
 */
router.post(
  '/matching',
  verificarAutenticacion,
  requerirRol('empresa', 'admin'),
  aiController.ejecutarMatching
);

/**
 * POST /api/v1/ai/recommendations
 * Devuelve recomendaciones ordenadas de profesionales.
 */
router.post(
  '/recommendations',
  verificarAutenticacion,
  requerirRol('empresa', 'admin'),
  aiController.obtenerRecomendaciones
);

/**
 * POST /api/v1/ai/classify
 * Clasifica una solicitud de servicio.
 */
router.post(
  '/classify',
  verificarAutenticacion,
  requerirRol('empresa', 'admin'),
  aiController.clasificarSolicitud
);

/**
 * POST /api/v1/ai/pricing
 * Estima un rango de precio inicial.
 */
router.post(
  '/pricing',
  verificarAutenticacion,
  aiController.estimarPrecio
);

/**
 * POST /api/v1/ai/chat
 * Chat IA con fallback por reglas.
 */
router.post(
  '/chat',
  verificarAutenticacion,
  aiController.chat
);

export const aiRoutes = router;
export default router;
