/**
 * @archivo notification.routes.ts
 * @descripcion Rutas HTTP para notificaciones multicanal de OfiAI.
 * Protege creación, lectura y reintentos con autenticación y RBAC.
 * @modulo Routes
 */

import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { verificarAutenticacion } from '../middleware/auth.middleware';
import { requerirRol } from '../middleware/role.middleware';
import { validarBody } from '../middleware/validation.middleware';
import { esquemaCrearNotificacion, esquemaProcesarReintentos } from '../validators/notification.validator';

const router = Router();

/**
 * GET /api/v1/notifications
 * Lista notificaciones internas del usuario autenticado.
 */
router.get(
  '/',
  verificarAutenticacion,
  notificationController.listarInternas
);

/**
 * POST /api/v1/notifications
 * Crea y envía notificaciones multicanal.
 */
router.post(
  '/',
  verificarAutenticacion,
  validarBody(esquemaCrearNotificacion),
  notificationController.crear
);

/**
 * POST /api/v1/notifications/retries
 * Procesa reintentos pendientes de notificaciones.
 */
router.post(
  '/retries',
  verificarAutenticacion,
  requerirRol('admin'),
  validarBody(esquemaProcesarReintentos),
  notificationController.procesarReintentos
);

/**
 * POST /api/v1/notifications/:id/read
 * Marca una notificación interna como leída.
 */
router.post(
  '/:id/read',
  verificarAutenticacion,
  notificationController.marcarComoLeida
);

export const notificationRoutes = router;
export default router;
