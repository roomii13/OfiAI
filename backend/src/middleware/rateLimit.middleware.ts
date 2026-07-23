/**
 * @archivo rateLimit.middleware.ts
 * @descripcion Middleware de limitación de frecuencia (Rate Limiting) para OfiAI Backend.
 * Protege los recursos del servidor contra abusos, ataques de fuerza bruta y consumo desmedido de la API de Gemini.
 * @modulo Middleware
 */

import rateLimit, { Options } from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../config/logger';

/**
 * Generador de respuesta estandarizada en JSON cuando se supera el límite de solicitudes.
 */
const crearManejadorExceso = (mensajePersonalizado: string) => {
  return (req: Request, res: Response, _next: unknown, options: Options): void => {
    logger.warn(`Límite de solicitudes alcanzado [${req.ip}] en ${req.originalUrl}`);
    res.status(options.statusCode).json({
      exito: false,
      mensaje: mensajePersonalizado,
      codigo: options.statusCode,
      reintentarEn: `${Math.ceil(options.windowMs / 60000)} minutos`,
    });
  };
};

/**
 * Limitador general de peticiones para todos los endpoints de la API REST.
 * Permite máximo 100 solicitudes cada 15 minutos por dirección IP.
 */
export const limitadorGeneral = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: crearManejadorExceso('Se ha superado el límite general de solicitudes. Por favor intente más tarde.'),
});

/**
 * Limitador estricto para endpoints de autenticación (Login, Registro, Recuperar Contraseña).
 * Permite máximo 10 intentos por hora para mitigar ataques de fuerza bruta.
 */
export const limitadorAuth = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: crearManejadorExceso('Demasiados intentos de autenticación. Por seguridad, intente en 1 hora.'),
});

/**
 * Limitador específico para endpoints que consumen la API de Google Gemini AI.
 * Permite máximo 20 consultas por minuto para controlar costos de tokens.
 */
export const limitadorIA = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: crearManejadorExceso('Límite de consultas a la Inteligencia Artificial alcanzado. Intente en 1 minuto.'),
});
