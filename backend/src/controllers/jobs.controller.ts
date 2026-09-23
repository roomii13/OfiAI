/**
 * @archivo jobs.controller.ts
 * @descripcion Controlador de jobs para OfiAI.
 * @modulo Controllers
 */
import { Response, NextFunction } from 'express';
import { RequestAutenticada } from '../middleware/auth.middleware';
import { ApiError } from '../middleware/error.middleware';
import { jobsService } from '../services/jobs.service';

/**
 * Controlador HTTP para trabajos.
 */
class JobsController {
  /**
   * Crea una solicitud de trabajo.
   */
  crearTrabajo = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contexto = this.obtenerContextoAutenticado(req);
      const resultado = await jobsService.crearTrabajo(contexto.usuarioId, req.body);

      res.status(201).json({
        exito: true,
        mensaje: 'Trabajo creado correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Obtiene un trabajo por ID.
   */
  obtenerTrabajo = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contexto = this.obtenerContextoAutenticado(req);
      const resultado = await jobsService.obtenerVisible(req.params.id!, contexto.usuarioId, contexto.rol);

      res.status(200).json({
        exito: true,
        mensaje: 'Trabajo obtenido correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Lista trabajos con filtros.
   */
  listarTrabajos = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contexto = this.obtenerContextoAutenticado(req);
      const resultado = await jobsService.listarVisibles(contexto.usuarioId, contexto.rol, {
        empresaId: req.query.empresaId as string | undefined,
        estado: req.query.estado as never,
        categoria: req.query.categoria as string | undefined,
        ciudad: req.query.ciudad as string | undefined,
        tipoTrabajo: req.query.tipoTrabajo as never,
        limite: req.query.limite ? Number(req.query.limite) : 50,
      });

      res.status(200).json({
        exito: true,
        mensaje: 'Trabajos obtenidos correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Actualiza un trabajo por ID.
   */
  actualizarTrabajo = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contexto = this.obtenerContextoAutenticado(req);
      const resultado = await jobsService.actualizarTrabajo(
        req.params.id!,
        contexto.usuarioId,
        contexto.rol,
        req.body
      );

      res.status(200).json({
        exito: true,
        mensaje: 'Trabajo actualizado correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Cancela un trabajo por ID.
   */
  eliminarTrabajo = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contexto = this.obtenerContextoAutenticado(req);
      const resultado = await jobsService.cancelarTrabajo(req.params.id!, contexto.usuarioId, contexto.rol);

      res.status(200).json({
        exito: true,
        mensaje: 'Trabajo cancelado correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Obtiene contexto autenticado.
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

export const jobsController = new JobsController();
export const crearTrabajo = jobsController.crearTrabajo;
export const obtenerTrabajo = jobsController.obtenerTrabajo;
export const actualizarTrabajo = jobsController.actualizarTrabajo;
export const eliminarTrabajo = jobsController.eliminarTrabajo;
export const listarTrabajos = jobsController.listarTrabajos;

