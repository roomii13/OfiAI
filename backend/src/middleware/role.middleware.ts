/**
 * @archivo role.middleware.ts
 * @descripcion Middleware de autorización basada en roles (RBAC) para OfiAI Backend.
 * Restringe el acceso a los endpoints según el rol asignado al usuario (empresa, profesional, admin).
 * @modulo Middleware
 */

import { Response, NextFunction } from 'express';
import { RequestAutenticada } from './auth.middleware';
import { RolUsuario } from '../models/User';
import { logger } from '../config/logger';

/**
 * Fábrica de middleware que restringe el acceso a usuarios que tengan al menos uno de los roles autorizados.
 * Debe utilizarse SIEMPRE después del middleware `verificarAutenticacion`.
 *
 * @param rolesPermitidos - Lista de roles autorizados para acceder a la ruta.
 * @returns Middleware de Express.
 */
export const requerirRol = (...rolesPermitidos: RolUsuario[]) => {
  return (req: RequestAutenticada, res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      logger.warn(`Intento de verificación de rol sin usuario autenticado en request: ${req.originalUrl}`);
      res.status(401).json({
        exito: false,
        mensaje: 'No autenticado. Por favor inicie sesión.',
        codigo: 401,
      });
      return;
    }

    const { rol, uid } = req.usuario;

    if (!rolesPermitidos.includes(rol)) {
      logger.warn(`Acceso denegado por rol insuficiente. Usuario UID: ${uid}, Rol: ${rol}, Requerido: ${rolesPermitidos.join(', ')}`);
      res.status(403).json({
        exito: false,
        mensaje: 'No tienes los permisos necesarios para realizar esta acción.',
        codigo: 403,
        detalles: {
          rolActual: rol,
          rolesPermitidos,
        },
      });
      return;
    }

    next();
  };
};
