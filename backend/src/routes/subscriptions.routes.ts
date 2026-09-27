/**
 * @archivo subscriptions.routes.ts
 * @descripcion Rutas de suscripciones para la API de OfiAI.
 * @modulo Routes
 */
import { Router } from 'express';
import { subscriptionController } from '../controllers/subscription.controller';
import { verificarAutenticacion } from '../middleware/auth.middleware';
import { validarBody, validarQuery } from '../middleware/validation.middleware';
import { ApiError } from '../middleware/error.middleware';
import { esquemaCambioPlan, esquemaCatalogo, esquemaRevenue, esquemaFeePreview, esquemaWebhook } from '../validators/subscription.validator';
import rateLimit from 'express-rate-limit';
import { esquemaCancelarSuscripcion, esquemaSuscribirse } from '../validators/subscription.validator';

const router = Router();
/** Rechaza IDs con separadores antes de acceder a Firestore. */
router.param('id', (_req, _res, next, id: string) => {
  next(/^[a-zA-Z0-9_-]{1,160}$/.test(id) ? undefined : new ApiError('Identificador de suscripcion invalido.', 400));
});
const billingLimiter = rateLimit({ windowMs: 60000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { exito: false, mensaje: 'Espera un momento antes de repetir la operacion de facturacion.' } });

/**
 * POST /api/v1/subscriptions/webhooks/mercadopago
 * Procesa eventos del proveedor de pagos Mercado Pago.
 */
router.post(
  '/webhooks/mercadopago',
  validarBody(esquemaWebhook),
  subscriptionController.webhookMercadoPago
);

/**
 * GET /api/v1/subscriptions/plans
 * Lista planes disponibles.
 */
router.get(
  '/plans',
  validarQuery(esquemaCatalogo),
  subscriptionController.listarPlanes
);

/**
 * POST /api/v1/subscriptions/checkout
 * Crea checkout o activa plan gratuito.
 */
router.post(
  '/checkout',
  verificarAutenticacion,
  billingLimiter,
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
  billingLimiter,
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
  billingLimiter,
  subscriptionController.renovarSuscripcion
);

router.get('/billing', verificarAutenticacion, subscriptionController.overview);
router.get('/revenue', verificarAutenticacion, validarQuery(esquemaRevenue), subscriptionController.revenue);
router.post('/fee-preview', verificarAutenticacion, validarBody(esquemaFeePreview), subscriptionController.feePreview);
router.post('/:id/change-plan', verificarAutenticacion, billingLimiter, validarBody(esquemaCambioPlan), subscriptionController.cambiarPlan);

export const subscriptionRoutes = router;
export default router;
