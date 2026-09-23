/**
 * @archivo scheduler.routes.ts
 * @descripcion Rutas administrativas para tareas programadas de OfiAI.
 * Permite ejecutar procesos automáticos bajo demanda con autenticación de administrador.
 * @modulo Routes
 */

import { Router } from 'express';
import { schedulerController } from '../controllers/scheduler.controller';
import { verificarAutenticacion } from '../middleware/auth.middleware';
import { requerirRol } from '../middleware/role.middleware';
import { validarBody } from '../middleware/validation.middleware';
import { esquemaEjecutarTareaProgramada } from '../validators/scheduler.validator';

const router = Router();

/**
 * POST /api/v1/scheduler/run
 * Ejecuta una tarea programada bajo demanda.
 */
router.post(
  '/run',
  verificarAutenticacion,
  requerirRol('admin'),
  validarBody(esquemaEjecutarTareaProgramada),
  schedulerController.ejecutarTarea
);

export const schedulerRoutes = router;
export default router;
