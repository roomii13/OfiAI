/**
 * @archivo analytics.routes.ts
 * @descripcion Rutas HTTP para Analytics, KPIs, reportes y exportaciones de OfiAI.
 * Protege métricas administrativas y permite registrar eventos autenticados.
 * @modulo Routes
 */

import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller';
import { verificarAutenticacion } from '../middleware/auth.middleware';
import { requerirRol } from '../middleware/role.middleware';
import { validarBody, validarQuery } from '../middleware/validation.middleware';
import {
  esquemaConsultaAnalytics,
  esquemaExportarReporteAnalytics,
  esquemaGenerarReporteAnalytics,
  esquemaRegistrarEventoAnalytics,
} from '../validators/analytics.validator';

const router = Router();

/**
 * POST /api/v1/analytics/events
 * Registra un evento de producto autenticado.
 */
router.post(
  '/events',
  verificarAutenticacion,
  validarBody(esquemaRegistrarEventoAnalytics),
  analyticsController.registrarEvento
);

/**
 * GET /api/v1/analytics/kpis
 * Obtiene KPIs administrativos.
 */
router.get(
  '/kpis',
  verificarAutenticacion,
  requerirRol('admin'),
  validarQuery(esquemaConsultaAnalytics),
  analyticsController.obtenerKpis
);

/**
 * GET /api/v1/analytics/usage
 * Obtiene estadísticas de uso.
 */
router.get(
  '/usage',
  verificarAutenticacion,
  requerirRol('admin'),
  validarQuery(esquemaConsultaAnalytics),
  analyticsController.obtenerEstadisticasUso
);

/**
 * POST /api/v1/analytics/reports
 * Genera un reporte persistido.
 */
router.post(
  '/reports',
  verificarAutenticacion,
  requerirRol('admin'),
  validarBody(esquemaGenerarReporteAnalytics),
  analyticsController.generarReporte
);

/**
 * GET /api/v1/analytics/reports/:id/export
 * Exporta un reporte en JSON o CSV.
 */
router.get(
  '/reports/:id/export',
  verificarAutenticacion,
  requerirRol('admin'),
  validarQuery(esquemaExportarReporteAnalytics),
  analyticsController.exportarReporte
);

export const analyticsRoutes = router;
export default router;
