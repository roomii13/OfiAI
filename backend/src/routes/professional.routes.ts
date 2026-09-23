/**
 * @archivo professional.routes.ts
 * @descripcion Rutas de profesionales para la API de OfiAI.
 * @modulo Routes
 */
import { Router } from 'express';
import { professionalController } from '../controllers/professional.controller';
import { verificarAutenticacion } from '../middleware/auth.middleware';
import { requerirRol } from '../middleware/role.middleware';
import { validarBody, validarQuery } from '../middleware/validation.middleware';
import {
  esquemaActualizarProfesional,
  esquemaCrearProfesional,
  esquemaFiltrosProfesional,
} from '../validators/professional.validator';

const router = Router();

/**
 * GET /api/v1/professionals
 * Busca profesionales con filtros.
 */
router.get(
  '/',
  verificarAutenticacion,
  validarQuery(esquemaFiltrosProfesional),
  professionalController.buscarProfesionales
);

/**
 * POST /api/v1/professionals
 * Crea perfil profesional.
 */
router.post(
  '/',
  verificarAutenticacion,
  requerirRol('profesional', 'admin'),
  validarBody(esquemaCrearProfesional),
  professionalController.crearProfesional
);

/**
 * GET /api/v1/professionals/me/profile
 * Obtiene perfil profesional del usuario autenticado.
 */
router.get(
  '/me/profile',
  verificarAutenticacion,
  requerirRol('profesional', 'admin'),
  professionalController.obtenerMiPerfil
);

/**
 * GET /api/v1/professionals/:id
 * Obtiene un profesional por ID.
 */
router.get(
  '/:id',
  verificarAutenticacion,
  professionalController.obtenerProfesional
);

/**
 * PUT /api/v1/professionals/:id
 * Actualiza perfil profesional.
 */
router.put(
  '/:id',
  verificarAutenticacion,
  requerirRol('profesional', 'admin'),
  validarBody(esquemaActualizarProfesional),
  professionalController.actualizarProfesional
);

export const professionalRoutes = router;
export default router;
