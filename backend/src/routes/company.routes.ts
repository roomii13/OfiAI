/**
 * @archivo company.routes.ts
 * @descripcion Rutas HTTP para la gestión de Empresas en OfiAI API.
 * Asocia controladores con middlewares de autenticación Firebase, verificación de roles (RBAC) y validaciones Zod.
 * @modulo Routes
 */

import { Router } from 'express';
import { companyController } from '../controllers/company.controller';
import { verificarAutenticacion } from '../middleware/auth.middleware';
import { requerirRol } from '../middleware/role.middleware';
import { validarBody } from '../middleware/validation.middleware';
import { esquemaCrearEmpresa, esquemaActualizarEmpresa } from '../validators/company.validator';

const router = Router();

/**
 * POST /api/v1/companies
 * Crear perfil de empresa para usuario autenticado (Rol 'empresa' o 'admin').
 */
router.post(
  '/',
  verificarAutenticacion,
  requerirRol('empresa', 'admin'),
  validarBody(esquemaCrearEmpresa),
  companyController.crearEmpresa
);

/**
 * GET /api/v1/companies
 * Consultar catálogo paginado de empresas con filtros (requiere autenticación).
 */
router.get(
  '/',
  verificarAutenticacion,
  companyController.listarEmpresas
);

/**
 * GET /api/v1/companies/me/profile
 * Obtener el perfil de empresa perteneciente al usuario autenticado.
 */
router.get(
  '/me/profile',
  verificarAutenticacion,
  requerirRol('empresa', 'admin'),
  companyController.obtenerMiEmpresa
);

/**
 * GET /api/v1/companies/:id
 * Obtener el perfil público de una empresa por ID.
 */
router.get(
  '/:id',
  verificarAutenticacion,
  companyController.obtenerEmpresa
);

/**
 * PUT /api/v1/companies/:id
 * Actualizar parcialmente la empresa por ID (requiere rol empresa propietario o admin).
 */
router.put(
  '/:id',
  verificarAutenticacion,
  requerirRol('empresa', 'admin'),
  validarBody(esquemaActualizarEmpresa),
  companyController.actualizarEmpresa
);

/**
 * DELETE /api/v1/companies/:id
 * Eliminar lógicamente (Soft Delete) la empresa por ID.
 */
router.delete(
  '/:id',
  verificarAutenticacion,
  requerirRol('empresa', 'admin'),
  companyController.eliminarEmpresa
);

export const companyRoutes = router;
export default router;
