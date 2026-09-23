/**
 * @archivo auth.middleware.ts
 * @descripcion Middleware de autenticación para OfiAI Backend.
 * Extrae y valida el token JWT de Firebase de la solicitud HTTP y adjunta la identidad del usuario a la Request.
 * @modulo Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { getAuth } from '../config/firebase';
import { logger } from '../config/logger';
import { RolUsuario } from '../models/User';
import { userRepository } from '../repositories/user.repository';

/**
 * Extensión de la interfaz Request de Express para incluir los datos del usuario autenticado.
 */
export interface RequestAutenticada extends Request {
  usuario?: {
    uid: string;
    email: string;
    rol: RolUsuario;
    emailVerificado: boolean;
  };
}

/**
 * Middleware que verifica el token ID de Firebase en el header Authorization.
 * Si el token es válido, adjunta la información del usuario a `req.usuario`.
 * Si el token es inválido o no existe, responde con estado 401 y formato JSON estandarizado.
 */
export const verificarAutenticacion = async (
  req: RequestAutenticada,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn(`Intento de acceso no autenticado a ruta protegida: ${req.originalUrl}`);
    res.status(401).json({
      exito: false,
      mensaje: 'Acceso no autorizado. Se requiere un token de autenticación válido.',
      codigo: 401,
    });
    return;
  }

  const token = authHeader.split('Bearer ')[1]?.trim();

  if (!token) {
    res.status(401).json({
      exito: false,
      mensaje: 'Formato de token inválido.',
      codigo: 401,
    });
    return;
  }

  try {
    const auth = getAuth();
    const tokenDecodificado = await auth.verifyIdToken(token, true);

    // Extraer el rol desde custom claims o asignar 'profesional' por defecto
    const usuario = await userRepository.findById(tokenDecodificado.uid);
    if (!usuario || !usuario.activo || !['empresa', 'profesional', 'admin'].includes(usuario.rol)) {
      res.status(403).json({ exito: false, mensaje: 'Cuenta deshabilitada o sin un rol valido.' });
      return;
    }
    const rolUsuario = usuario.rol;

    req.usuario = {
      uid: tokenDecodificado.uid,
      email: tokenDecodificado.email || '',
      rol: rolUsuario,
      emailVerificado: Boolean(tokenDecodificado.email_verified),
    };

    next();
  } catch (error: unknown) {
    const mensajeError = error instanceof Error ? error.message : 'Error desconocido al validar el token';
    logger.error('Error al verificar el token de Firebase:', { error: mensajeError, path: req.originalUrl });

    res.status(401).json({
      exito: false,
      mensaje: 'El token proporcionado ha expirado o es inválido.',
      codigo: 401,
    });
  }
};
