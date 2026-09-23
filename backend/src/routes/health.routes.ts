/**
 * @archivo health.routes.ts
 * @descripcion Rutas de monitoreo del backend OfiAI.
 * Expone health, liveness y readiness para producción.
 * @modulo Routes
 */
import { Router } from 'express';
import { healthCheck, livenessCheck, readinessCheck } from '../monitoring/health';

const router = Router();

/**
 * GET /api/v1/health
 * Estado general del backend y servicios configurados.
 */
router.get('/', healthCheck);

/**
 * GET /api/v1/health/liveness
 * Prueba de vida del proceso HTTP.
 */
router.get('/liveness', livenessCheck);

/**
 * GET /api/v1/health/readiness
 * Verificación segura de configuración productiva.
 */
router.get('/readiness', readinessCheck);

export const healthRoutes = router;
