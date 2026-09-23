/**
 * @archivo ai.controller.ts
 * @descripcion Controlador de ai para OfiAI.
 * @modulo Controllers
 */
import { Response, NextFunction } from 'express';
import { RequestAutenticada } from '../middleware/auth.middleware';
import { aiService } from '../services/ai.service';
import { intakeService } from '../services/intake.service';

/**
 * Controlador HTTP para las capacidades IA de OfiAI.
 */
class AiController {
  /** Adaptador HTTP de comandos Intake; identidad y propiedad se resuelven en servidor. */
  intake = (action: 'start' | 'list' | 'get' | 'message' | 'confirm' | 'abandon') =>
    async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { usuarioId, rol } = this.obtenerContextoAutenticado(req);
        const id = String(req.params.id ?? '');
        const data = action === 'start' ? await intakeService.start(usuarioId, rol, req.body.requestId)
          : action === 'list' ? await intakeService.list(usuarioId, rol)
          : action === 'get' ? await intakeService.get(usuarioId, rol, id)
          : action === 'message' ? await intakeService.message(usuarioId, rol, id, req.body)
          : action === 'confirm' ? await intakeService.confirm(usuarioId, rol, id, req.body.expectedVersion)
          : await intakeService.abandon(usuarioId, rol, id, req.body.expectedVersion);
        res.status(action === 'start' ? 201 : 200).json({ exito: true, datos: data });
      } catch (error) { next(error); }
    };

  /**
   * Ejecuta matching inteligente entre trabajo y profesionales.
   */
  ejecutarMatching = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contexto = this.obtenerContextoAutenticado(req);
      const resultado = await aiService.ejecutarMatching(req.body, contexto.usuarioId, contexto.rol);

      res.status(200).json({
        exito: true,
        mensaje: 'Matching inteligente ejecutado correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Obtiene recomendaciones de profesionales para una solicitud o trabajo.
   */
  obtenerRecomendaciones = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contexto = this.obtenerContextoAutenticado(req);
      const resultado = await aiService.obtenerRecomendaciones(req.body, contexto.usuarioId, contexto.rol);

      res.status(200).json({
        exito: true,
        mensaje: 'Recomendaciones generadas correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Clasifica automáticamente una solicitud de trabajo.
   */
  clasificarSolicitud = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resultado = aiService.clasificarSolicitud(req.body);

      res.status(200).json({
        exito: true,
        mensaje: 'Solicitud clasificada correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Estima precio sugerido para una solicitud.
   */
  estimarPrecio = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resultado = aiService.estimarPrecio(req.body);

      res.status(200).json({
        exito: true,
        mensaje: 'Completa el alcance y las referencias de un Job para estimar su precio.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Responde mensajes del chat IA.
   */
  chat = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contexto = this.obtenerContextoAutenticado(req);
      const resultado = await aiService.chatear(req.body, contexto.usuarioId, contexto.rol);

      res.status(200).json({
        exito: true,
        mensaje: 'Respuesta IA generada correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Extrae contexto autenticado o lanza una respuesta 401 consistente.
   */
  private obtenerContextoAutenticado(req: RequestAutenticada): { usuarioId: string; rol: NonNullable<RequestAutenticada['usuario']>['rol'] } {
    const usuarioId = req.usuario?.uid;
    const rol = req.usuario?.rol;

    if (!usuarioId || !rol) {
      throw new Error('Usuario no autenticado.');
    }

    return { usuarioId, rol };
  }
}

export const aiController = new AiController();
export const ejecutarMatching = aiController.ejecutarMatching;
export const estimarPrecio = aiController.estimarPrecio;
export const obtenerRecomendaciones = aiController.obtenerRecomendaciones;

