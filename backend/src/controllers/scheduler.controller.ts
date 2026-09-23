/**
 * @archivo scheduler.controller.ts
 * @descripcion Controlador HTTP para ejecutar tareas programadas de OfiAI bajo demanda administrativa.
 * Permite disparar recordatorios, renovaciones, limpieza, reintentos y reportes.
 * @modulo Controllers
 */

import { Response, NextFunction } from 'express';
import { RequestAutenticada } from '../middleware/auth.middleware';
import { schedulerService, TareaProgramadaNombre } from '../scheduler/scheduler.service';

/**
 * Controlador administrativo del scheduler.
 */
class SchedulerController {
  /**
   * Ejecuta una tarea programada bajo demanda.
   */
  ejecutarTarea = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resultado = await schedulerService.run(req.body.tarea as TareaProgramadaNombre);

      res.status(200).json({
        exito: true,
        mensaje: 'Tarea programada ejecutada correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const schedulerController = new SchedulerController();
