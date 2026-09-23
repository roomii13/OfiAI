/**
 * @archivo auth.controller.ts
 * @descripcion Controlador HTTP para el módulo de autenticación de OfiAI.
 * Recibe peticiones HTTP, delega la lógica de negocio a authService y retorna respuestas estandarizadas en JSON.
 * @modulo Controllers
 */

import { Response, NextFunction } from 'express';
import { RequestAutenticada } from '../middleware/auth.middleware';
import { authService } from '../services/auth.service';

/** Adapta solicitudes de autenticacion y cuenta al servicio. */
class AuthController {
  /** Actualiza preferencias de notificacion de la cuenta autenticada. */
  updatePreferences = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.usuario) { res.status(401).json({ exito: false }); return; }
      await authService.updatePreferences(req.usuario.uid, req.body);
      res.json({ exito: true, datos: req.body });
    } catch (error) { next(error); }
  };

  /**
   * Registra una nueva empresa en la plataforma.
   */
  registerCompany = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resultado = await authService.registerCompany(req.body);
      res.status(201).json({
        exito: true,
        mensaje: 'Empresa registrada correctamente en OfiAI.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Registra un nuevo profesional de oficios en la plataforma.
   */
  registerProfessional = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resultado = await authService.registerProfessional(req.body);
      res.status(201).json({
        exito: true,
        mensaje: 'Profesional registrado correctamente en OfiAI.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Inicia sesión verificando credenciales y otorgando custom token.
   */
  login = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resultado = await authService.login(req.body);
      res.status(200).json({
        exito: true,
        mensaje: 'Inicio de sesión exitoso.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Solicita el envío de enlace de recuperación de contraseña.
   */
  recoverPassword = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      await authService.recoverPassword(req.body.email);
      res.status(200).json({
        exito: true,
        mensaje: 'Si el correo electrónico existe en nuestra plataforma, se ha enviado un enlace de recuperación.',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Obtiene el perfil completo del usuario autenticado.
   */
  me = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const uid = req.usuario?.uid;
      if (!uid) {
        res.status(401).json({
          exito: false,
          mensaje: 'Usuario no autenticado.',
          codigo: 401,
        });
        return;
      }

      const resultado = await authService.getUserProfile(uid);
      res.status(200).json({
        exito: true,
        mensaje: 'Perfil obtenido correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Cierra la sesión activa revocando refresh tokens.
   */
  logout = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const uid = req.usuario?.uid;
      if (uid) {
        await authService.logout(uid);
      }
      res.status(200).json({
        exito: true,
        mensaje: 'Sesión cerrada correctamente.',
      });
    } catch (error) {
      next(error);
    }
  };
}

export const authController = new AuthController();
