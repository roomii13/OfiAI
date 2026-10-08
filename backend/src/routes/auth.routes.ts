/**
 * @archivo auth.routes.ts
 * @descripcion Definición de rutas HTTP públicas y privadas para el módulo de Autenticación de OfiAI.
 * Asocia middlewares de Rate Limiting, validación de schemas con Zod y verificación de Firebase ID Token.
 * @modulo Routes
 */

import { Router } from 'express';
import { z } from 'zod';
import { authController } from '../controllers/auth.controller';
import { verificarAutenticacion } from '../middleware/auth.middleware';
import { limitadorAuth } from '../middleware/rateLimit.middleware';
import { validarBody } from '../middleware/validation.middleware';
import {
  esquemaRegistroEmpresa,
  esquemaRegistroParticular,
  esquemaRegistroProfesional,
  esquemaLogin,
  esquemaRecuperarPassword,
} from '../validators/auth.validator';

const router = Router();

/** Registro gratuito para personas que necesitan contratar un servicio. */
router.post('/register/citizen', limitadorAuth, validarBody(esquemaRegistroParticular), authController.registerCitizen);

/** PUT /auth/preferences actualiza unicamente canales permitidos. */
router.put('/preferences', verificarAutenticacion, validarBody(z.object({
  email: z.boolean(), whatsapp: z.boolean(), push: z.boolean(), in_app: z.boolean(),
}).strict()), authController.updatePreferences);

/**
 * POST /api/v1/auth/register/company
 * Registro público de nuevas empresas.
 */
router.post(
  '/register/company',
  limitadorAuth,
  validarBody(esquemaRegistroEmpresa),
  authController.registerCompany
);

/**
 * POST /api/v1/auth/register/professional
 * Registro público de nuevos profesionales de oficios.
 */
router.post(
  '/register/professional',
  limitadorAuth,
  validarBody(esquemaRegistroProfesional),
  authController.registerProfessional
);

/**
 * POST /api/v1/auth/login
 * Inicio de sesión público.
 */
router.post(
  '/login',
  limitadorAuth,
  validarBody(esquemaLogin),
  authController.login
);

/**
 * POST /api/v1/auth/recover-password
 * Solicitud pública de restablecimiento de contraseña.
 */
router.post(
  '/recover-password',
  limitadorAuth,
  validarBody(esquemaRecuperarPassword),
  authController.recoverPassword
);

/**
 * POST /api/v1/auth/logout
 * Cierre de sesión privado (requiere token de autenticación).
 */
router.post(
  '/logout',
  verificarAutenticacion,
  authController.logout
);

/**
 * GET /api/v1/auth/me
 * Obtención de datos del perfil autenticado (requiere token de autenticación).
 */
router.get(
  '/me',
  verificarAutenticacion,
  authController.me
);

export const authRoutes = router;
