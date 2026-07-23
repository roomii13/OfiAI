/**
 * @archivo validation.middleware.ts
 * @descripcion Middleware para validar datos de entrada HTTP utilizando esquemas de Zod.
 * Valida el cuerpo (body), parámetros de consulta (query) y parámetros de ruta (params).
 * @modulo Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { logger } from '../config/logger';

/**
 * Valida el cuerpo de la solicitud HTTP (req.body) contra un esquema Zod.
 * @param schema - Esquema Zod de validación.
 */
export const validarBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const resultado = schema.safeParse(req.body);

    if (!resultado.success) {
      logger.warn(`Error de validación de body en ${req.originalUrl}:`, { errores: resultado.error.format() });
      res.status(400).json({
        exito: false,
        mensaje: 'Error de validación en la solicitud.',
        codigo: 400,
        detalles: resultado.error.errors.map((issue) => ({
          campo: issue.path.join('.'),
          mensaje: issue.message,
        })),
      });
      return;
    }

    req.body = resultado.data;
    next();
  };
};

/**
 * Valida los parámetros de consulta HTTP (req.query) contra un esquema Zod.
 * @param schema - Esquema Zod de validación.
 */
export const validarQuery = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const resultado = schema.safeParse(req.query);

    if (!resultado.success) {
      logger.warn(`Error de validación de query en ${req.originalUrl}:`, { errores: resultado.error.format() });
      res.status(400).json({
        exito: false,
        mensaje: 'Parámetros de consulta inválidos.',
        codigo: 400,
        detalles: resultado.error.errors.map((issue) => ({
          campo: issue.path.join('.'),
          mensaje: issue.message,
        })),
      });
      return;
    }

    req.query = resultado.data as typeof req.query;
    next();
  };
};
