/**
 * @archivo subscriptions.routes.ts
 * @descripcion Rutas de suscripciones para la API de OfiAI.
 * @modulo Routes
 */
import { Router } from 'express';
import { subscriptionController } from '../controllers/subscription.controller';
import { verificarAutenticacion } from '../middleware/auth.middleware';
import { validarBody } from '../middleware/validation.middleware';
import { esquemaCancelarSuscripcion, esquemaSuscribirse } from '../validators/subscription.validator';

const router = Router();

/**
 * POST /api/v1/subscriptions/webhooks/mercadopago
 * Procesa eventos del proveedor de pagos Mercado Pago.
 */
router.post(
  '/webhooks/mercadopago',
  subscriptionController.webhookMercadoPago
);

/**
 * GET /api/v1/subscriptions/plans
 * Lista planes disponibles.
 */
router.get(
  '/plans',
  subscriptionController.listarPlanes
);

/**
 * POST /api/v1/subscriptions/checkout
 * Crea checkout o activa plan gratuito.
 */
router.post(
  '/checkout',
  verificarAutenticacion,
  validarBody(esquemaSuscribirse),
  subscriptionController.crearSuscripcion
);

/**
 * GET /api/v1/subscriptions/me
 * Obtiene suscripción vigente del usuario.
 */
router.get(
  '/me',
  verificarAutenticacion,
  subscriptionController.obtenerSuscripcion
);

/**
 * GET /api/v1/subscriptions/history
 * Obtiene historial de suscripciones y eventos.
 */
router.get(
  '/history',
  verificarAutenticacion,
  subscriptionController.obtenerHistorial
);

/**
 * POST /api/v1/subscriptions/:id/cancel
 * Cancela una suscripción.
 */
router.post(
  '/:id/cancel',
  verificarAutenticacion,
  validarBody(esquemaCancelarSuscripcion),
  subscriptionController.cancelarSuscripcion
);

/**
 * POST /api/v1/subscriptions/:id/renew
 * Renueva manualmente una suscripción.
 */
router.post(
  '/:id/renew',
  verificarAutenticacion,
  subscriptionController.renovarSuscripcion
);

export const subscriptionRoutes = router;
export default router;
