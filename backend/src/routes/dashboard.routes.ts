/**
 * @archivo dashboard.routes.ts
 * @descripcion Rutas de dashboard para la API de OfiAI.
 * @modulo Routes
 */
import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { verificarAutenticacion } from '../middleware/auth.middleware';
import { requerirRol } from '../middleware/role.middleware';

const router = Router();

/**
 * GET /api/v1/dashboard/company
 * Obtiene dashboard operativo para empresas.
 */
router.get(
  '/company',
  verificarAutenticacion,
  requerirRol('empresa', 'admin'),
  dashboardController.dashboardEmpresa
);

/**
 * GET /api/v1/dashboard/professional
 * Obtiene dashboard operativo para profesionales.
 */
router.get(
  '/professional',
  verificarAutenticacion,
  requerirRol('profesional', 'admin'),
  dashboardController.dashboardProfesional
);

/**
 * GET /api/v1/dashboard/admin
 * Obtiene dashboard global de administración.
 */
router.get(
  '/admin',
  verificarAutenticacion,
  requerirRol('admin'),
  dashboardController.dashboardAdmin
);

export const dashboardRoutes = router;
export default router;
