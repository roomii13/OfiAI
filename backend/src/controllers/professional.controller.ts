/**
 * @archivo professional.controller.ts
 * @descripcion Controlador de professional para OfiAI.
 * @modulo Controllers
 */
import { Response, NextFunction } from 'express';
import { RequestAutenticada } from '../middleware/auth.middleware';
import { ApiError } from '../middleware/error.middleware';
import { professionalService } from '../services/professional.service';

/**
 * Controlador HTTP para perfiles profesionales.
 */
class ProfessionalController {
  /**
   * Crea un perfil profesional para el usuario autenticado.
   */
  crearProfesional = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contexto = this.obtenerContextoAutenticado(req);
      const resultado = await professionalService.crearProfesional(contexto.usuarioId, req.body);

      res.status(201).json({
        exito: true,
        mensaje: 'Perfil profesional creado correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Obtiene un profesional por ID.
   */
  obtenerProfesional = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resultado = await professionalService.obtenerProfesional(req.params.id!);

      res.status(200).json({
        exito: true,
        mensaje: 'Profesional obtenido correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Obtiene el perfil profesional del usuario autenticado.
   */
  obtenerMiPerfil = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contexto = this.obtenerContextoAutenticado(req);
      const resultado = await professionalService.obtenerMiPerfil(contexto.usuarioId);

      res.status(200).json({
        exito: true,
        mensaje: 'Perfil profesional propio obtenido correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Actualiza un profesional por ID.
   */
  actualizarProfesional = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contexto = this.obtenerContextoAutenticado(req);
      const resultado = await professionalService.actualizarProfesional(
        req.params.id!,
        contexto.usuarioId,
        contexto.rol,
        req.body
      );

      res.status(200).json({
        exito: true,
        mensaje: 'Perfil profesional actualizado correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Busca profesionales con filtros.
   */
  buscarProfesionales = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resultado = await professionalService.buscarProfesionales({
        categoria: req.query.categoria as string | undefined,
        especialidad: req.query.especialidad as string | undefined,
        ciudad: req.query.ciudad as string | undefined,
        pais: req.query.pais as string | undefined,
        disponible: req.query.disponible as boolean | undefined,
        verificado: req.query.verificado as boolean | undefined,
        limite: req.query.limite ? Number(req.query.limite) : 50,
      });

      res.status(200).json({
        exito: true,
        mensaje: 'Profesionales encontrados correctamente.',
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

export const professionalController = new ProfessionalController();
export const crearProfesional = professionalController.crearProfesional;
export const obtenerProfesional = professionalController.obtenerProfesional;
export const actualizarProfesional = professionalController.actualizarProfesional;
export const buscarProfesionales = professionalController.buscarProfesionales;

