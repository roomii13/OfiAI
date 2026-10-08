/**
 * @archivo jobs.routes.ts
 * @descripcion Rutas de trabajos para la API de OfiAI.
 * @modulo Routes
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { pricingRoutes } from './pricing.routes';
import { coordinatorRoutes } from './coordinator.routes';
import { protectedContractRoutes } from './protected-contract.routes';
import { matchingController } from '../controllers/matching.controller';
import { matchingCommandSchema, matchingSelectionSchema, matchingViewSchema } from '../validators/matching.validator';
import { limitadorIA } from '../middleware/rateLimit.middleware';
import { ApiError } from '../middleware/error.middleware';
import { jobsController } from '../controllers/jobs.controller';
import { reviewController } from '../controllers/review.controller';
import { verificarAutenticacion } from '../middleware/auth.middleware';
import { requerirRol } from '../middleware/role.middleware';
import { validarBody, validarQuery } from '../middleware/validation.middleware';
import { esquemaActualizarTrabajo, esquemaCrearTrabajo, esquemaFiltrosTrabajo } from '../validators/job.validator';

const router = Router();
router.use('/:id/contract', protectedContractRoutes);
/** Resenas verificadas de los participantes; la identidad no viene del body. */
router.get('/:id/review', verificarAutenticacion, reviewController.get);
router.post('/:id/review', verificarAutenticacion, reviewController.create);
router.use('/:id/coordinator', coordinatorRoutes);
router.use('/:id/pricing', pricingRoutes);
const matching = Router({ mergeParams: true });
matching.use(verificarAutenticacion, requerirRol('empresa'));
matching.post('/matching', limitadorIA, validarBody(matchingCommandSchema), matchingController.handle('execute'));
matching.get('/matches', matchingController.handle('get'));
matching.get('/matches/:professionalId/profile', matchingController.handle('profile'));
matching.post('/matches/:professionalId/select', limitadorIA, validarBody(matchingSelectionSchema), matchingController.handle('select'));
matching.post('/matches/events', limitadorIA, validarBody(matchingViewSchema), matchingController.handle('view'));
/** Respuestas seguras incluso cuando falla Firestore o el proveedor. */
matching.use((error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  res.status(error instanceof ApiError ? error.codigoEstado : 503).json({ exito: false,
    mensaje: error instanceof ApiError ? error.message : 'No pudimos completar la busqueda. Intenta nuevamente.' });
});
router.use('/:id', (req, res, next) => /^\/(matching|matches)(\/|$)/.test(req.path) ? matching(req, res, next) : next());

/**
 * GET /api/v1/jobs
 * Lista trabajos con filtros.
 */
router.get(
  '/',
  verificarAutenticacion,
  validarQuery(esquemaFiltrosTrabajo),
  jobsController.listarTrabajos
);

/**
 * POST /api/v1/jobs
 * Crea una solicitud de trabajo.
 */
router.post(
  '/',
  verificarAutenticacion,
  requerirRol('empresa', 'admin'),
  validarBody(esquemaCrearTrabajo),
  jobsController.crearTrabajo
);

/**
 * GET /api/v1/jobs/:id
 * Obtiene un trabajo por ID.
 */
router.get(
  '/:id',
  verificarAutenticacion,
  jobsController.obtenerTrabajo
);

/**
 * PUT /api/v1/jobs/:id
 * Actualiza un trabajo.
 */
router.put(
  '/:id',
  verificarAutenticacion,
  requerirRol('empresa', 'admin'),
  validarBody(esquemaActualizarTrabajo),
  jobsController.actualizarTrabajo
);

/**
 * DELETE /api/v1/jobs/:id
 * Cancela un trabajo.
 */
router.delete(
  '/:id',
  verificarAutenticacion,
  requerirRol('empresa', 'admin'),
  jobsController.eliminarTrabajo
);

export const jobsRoutes = router;
export default router;
