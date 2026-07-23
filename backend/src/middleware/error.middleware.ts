/**
 * @archivo error.middleware.ts
 * @descripcion Middleware global de captura y manejo de errores para OfiAI Backend.
 * Proporciona clasificación de excepciones, registro en logs y respuestas HTTP en JSON estandarizadas en español.
 * @modulo Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { logger, logError } from '../config/logger';
import { env } from '../config/env';

/**
 * Clase personalizada de Error para excepciones de la API con código de estado HTTP explícito.
 */
export class ApiError extends Error {
  public readonly codigoEstado: number;
  public readonly esOperacional: boolean;
  public readonly detalles?: unknown;

  constructor(
    mensaje: string,
    codigoEstado = 500,
    detalles?: unknown,
    esOperacional = true
  ) {
    super(mensaje);
    Object.setPrototypeOf(this, new.target.prototype);
    this.codigoEstado = codigoEstado;
    this.detalles = detalles;
    this.esOperacional = esOperacional;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Middleware global para capturar rutas inexistentes (HTTP 404).
 */
export const notFoundMiddleware = (req: Request, res: Response): void => {
  logger.warn(`Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    exito: false,
    mensaje: `La ruta solicitada '${req.method} ${req.originalUrl}' no existe en el servidor.`,
    codigo: 404,
  });
};

/**
 * Wrapper de orden superior para controladores asíncronos en Express.
 * Elimina la necesidad de bloques try-catch repetitivos en las rutas.
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
};

/**
 * Middleware principal de manejo de errores de Express. Debe registrarse al final de la cadena de rutas.
 */
export const errorMiddleware = (
  error: Error | ApiError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  let codigoEstado = 500;
  let mensaje = 'Ocurrió un error interno en el servidor.';
  let detalles: unknown = null;

  if (error instanceof ApiError) {
    codigoEstado = error.codigoEstado;
    mensaje = error.message;
    detalles = error.detalles || null;
  } else if (error.name === 'ZodError') {
    codigoEstado = 400;
    mensaje = 'Error de validación en los datos enviados.';
    detalles = (error as unknown as { issues: unknown }).issues;
  } else if (error.name === 'UnauthorizedError') {
    codigoEstado = 401;
    mensaje = 'No autorizado para realizar esta solicitud.';
  }

  logError(`[API Error] ${req.method} ${req.originalUrl} - ${codigoEstado} ${mensaje}`, error, {
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  res.status(codigoEstado).json({
    exito: false,
    mensaje,
    codigo: codigoEstado,
    ...(detalles ? { detalles } : {}),
    ...(env.NODE_ENV === 'development' ? { stack: error.stack } : {}),
  });
};
