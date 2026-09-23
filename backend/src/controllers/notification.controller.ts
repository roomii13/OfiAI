/**
 * @archivo notification.controller.ts
 * @descripcion Controlador HTTP para notificaciones multicanal de OfiAI.
 * Expone creación, listado interno, lectura y reintentos administrativos.
 * @modulo Controllers
 */

import { Response, NextFunction } from 'express';
import { RequestAutenticada } from '../middleware/auth.middleware';
import { ApiError } from '../middleware/error.middleware';
import { notificationService } from '../services/notification.service';
import { DatosCrearNotificacion } from '../validators/notification.validator';

/**
 * Controlador de notificaciones.
 */
class NotificationController {
  /**
   * Crea y envía notificaciones por los canales solicitados.
   */
  crear = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contexto = this.obtenerContextoAutenticado(req);
      const datos = req.body as DatosCrearNotificacion;
      const usuarioIdDestino = datos.usuarioId ?? contexto.usuarioId;

      if (contexto.rol !== 'admin' && usuarioIdDestino !== contexto.usuarioId) {
        throw new ApiError('No tienes autorización para crear notificaciones a otros usuarios.', 403);
      }

      const resultado = await notificationService.crearYEnviar({
        ...datos,
        usuarioId: usuarioIdDestino,
      });

      res.status(201).json({
        exito: true,
        mensaje: 'Notificaciones creadas correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Lista notificaciones internas del usuario autenticado.
   */
  listarInternas = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contexto = this.obtenerContextoAutenticado(req);
      const resultado = await notificationService.listarInternas(contexto.usuarioId);

      res.status(200).json({
        exito: true,
        mensaje: 'Notificaciones internas obtenidas correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Marca una notificación como leída.
   */
  marcarComoLeida = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contexto = this.obtenerContextoAutenticado(req);
      const resultado = await notificationService.marcarComoLeida(req.params.id!, contexto.usuarioId);

      res.status(200).json({
        exito: true,
        mensaje: 'Notificación marcada como leída.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Procesa reintentos pendientes de notificaciones fallidas o demoradas.
   */
  procesarReintentos = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limite = typeof req.body?.limite === 'number' ? req.body.limite : 50;
      const resultado = await notificationService.procesarReintentos(limite);

      res.status(200).json({
        exito: true,
        mensaje: 'Reintentos de notificaciones procesados correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Extrae el usuario autenticado del request.
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

export const notificationController = new NotificationController();
