/**
 * @archivo subscription.controller.ts
 * @descripcion Controlador de subscription para OfiAI.
 * @modulo Controllers
 */
import { Response, NextFunction } from 'express';
import { RequestAutenticada } from '../middleware/auth.middleware';
import { ApiError } from '../middleware/error.middleware';
import { subscriptionService } from '../services/subscription.service';
import { subscriptionRepository } from '../repositories/subscription.repository';

/**
 * Controlador HTTP para suscripciones y pagos.
 */
class SubscriptionController {
  /**
   * Lista los planes comerciales disponibles.
   */
  listarPlanes = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.status(200).json({
        exito: true,
        mensaje: 'Planes de suscripción obtenidos correctamente.',
        datos: await subscriptionService.listarPlanes(req.query.audience as 'empresa' | 'profesional' | undefined),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Crea checkout o activa plan gratuito.
   */
  crearSuscripcion = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contexto = this.obtenerContextoAutenticado(req);
      const resultado = await subscriptionService.crearCheckout(contexto.usuarioId, contexto.rol, req.body);

      res.status(201).json({
        exito: true,
        mensaje: 'Proceso de suscripción iniciado correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Obtiene la suscripción vigente del usuario autenticado.
   */
  obtenerSuscripcion = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contexto = this.obtenerContextoAutenticado(req);
      const resultado = await subscriptionService.obtenerActual(contexto.usuarioId);

      res.status(200).json({
        exito: true,
        mensaje: 'Suscripción actual obtenida correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Obtiene historial de suscripciones y eventos.
   */
  obtenerHistorial = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contexto = this.obtenerContextoAutenticado(req);
      const resultado = await subscriptionService.obtenerHistorial(contexto.usuarioId);

      res.status(200).json({
        exito: true,
        mensaje: 'Historial de suscripciones obtenido correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Cancela una suscripción existente.
   */
  cancelarSuscripcion = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contexto = this.obtenerContextoAutenticado(req);
      const resultado = await subscriptionService.cancelarSuscripcion(
        req.params.id!,
        contexto.usuarioId,
        contexto.rol,
        req.body
      );

      res.status(200).json({
        exito: true,
        mensaje: 'Suscripción cancelada correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Concilia la renovacion mensual automatica con el proveedor.
   */
  renovarSuscripcion = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contexto = this.obtenerContextoAutenticado(req);
      const resultado = await subscriptionService.renovarSuscripcion(
        req.params.id!,
        contexto.usuarioId,
        contexto.rol
      );

      res.status(200).json({
        exito: true,
        mensaje: 'Estado de cobros recurrentes actualizado.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Procesa webhooks de Mercado Pago.
   */
  webhookMercadoPago = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const firma = req.headers['x-signature'];
      const requestId = req.headers['x-request-id'];
      const resultado = await subscriptionService.procesarWebhookMercadoPago(
        req.body,
        Array.isArray(firma) ? firma[0] : firma,
        Array.isArray(requestId) ? requestId[0] : requestId,
        typeof req.query['data.id'] === 'string' ? req.query['data.id'] : undefined
      );

      res.status(200).json({
        exito: true,
        mensaje: 'Webhook procesado correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /** Devuelve limites efectivos y ultimos pagos propios. */
  overview = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = this.obtenerContextoAutenticado(req);
      res.json({ exito: true, datos: await subscriptionService.overview(context.usuarioId, context.rol) });
    } catch (error) { next(error); }
  };

  /** Programa un cambio sin modificar acceso pagado antes de su proximo cobro. */
  cambiarPlan = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = this.obtenerContextoAutenticado(req);
      res.json({ exito: true, datos: await subscriptionService.cambiarPlan(req.params.id!, context.usuarioId, context.rol, req.body.plan, req.body.expectedPriceMinor) });
    } catch (error) { next(error); }
  };

  /** Permite solo a administracion consultar ingresos confirmados por moneda. */
  revenue = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (this.obtenerContextoAutenticado(req).rol !== 'admin') throw new ApiError('Acceso exclusivo de administracion.', 403);
      res.json({ exito: true, datos: await subscriptionRepository.revenue(String(req.query.month)) });
    } catch (error) { next(error); }
  };

  /** Previsualiza una comision configurada sin ejecutar movimientos financieros. */
  feePreview = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.obtenerContextoAutenticado(req);
      res.json({ exito: true, datos: subscriptionService.feePreview(req.body.grossMinor) });
    } catch (error) { next(error); }
  };

  /**
   * Extrae usuario autenticado desde el request.
   */
  private obtenerContextoAutenticado(req: RequestAutenticada): { usuarioId: string; rol: NonNullable<RequestAutenticada['usuario']>['rol'] } {
    const usuarioId = req.usuario?.uid;
    const rol = req.usuario?.rol;

    if (!usuarioId || !rol) {
      throw new ApiError('Usuario no autenticado.', 401);
    }

    return { usuarioId, rol };
  }
}

export const subscriptionController = new SubscriptionController();
export const crearSuscripcion = subscriptionController.crearSuscripcion;
export const cancelarSuscripcion = subscriptionController.cancelarSuscripcion;
export const obtenerSuscripcion = subscriptionController.obtenerSuscripcion;
export const webhookMercadoPago = subscriptionController.webhookMercadoPago;

