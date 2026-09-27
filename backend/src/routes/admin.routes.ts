/**
 * @archivo admin.routes.ts
 * @descripcion Rutas de administración para la API de OfiAI.
 * @modulo Routes
 */
import { Router } from 'express';
import {
  listarUsuarios,
  obtenerMetricas,
  obtenerReporte,
  suspenderUsuario,
} from '../controllers/admin.controller';
import { verificarAutenticacion } from '../middleware/auth.middleware';
import { requerirRol } from '../middleware/role.middleware';
import { operationsController } from '../controllers/operations.controller';
import { limitadorIA } from '../middleware/rateLimit.middleware';

const router = Router();

router.use(verificarAutenticacion, requerirRol('admin'));
router.get('/operations',limitadorIA,operationsController.list);
router.post('/operations/commands',limitadorIA,operationsController.command);
router.get('/command-center',limitadorIA,operationsController.center);

/**
 * GET /api/v1/admin/metrics
 * Obtiene métricas globales de administración.
 */
router.get('/metrics', obtenerMetricas);

/**
 * GET /api/v1/admin/users
 * Lista usuarios recientes.
 */
router.get('/users', listarUsuarios);

/**
 * PATCH /api/v1/admin/users/:id/status
 * Suspende o reactiva usuarios.
 */
router.patch('/users/:id/status', suspenderUsuario);

/**
 * GET /api/v1/admin/reports/summary
 * Devuelve reporte administrativo resumido.
 */
router.get('/reports/summary', obtenerReporte);

export const adminRoutes = router;
export default router;
