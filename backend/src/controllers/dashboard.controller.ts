/**
 * @archivo dashboard.controller.ts
 * @descripcion Controlador de dashboard para OfiAI.
 * @modulo Controllers
 */
import { Response, NextFunction } from 'express';
import { RequestAutenticada } from '../middleware/auth.middleware';
import { dashboardService } from '../services/dashboard.service';

/**
 * Controlador HTTP del módulo Dashboard.
 */
class DashboardController {
  /**
   * Entrega KPIs, estadísticas, actividad reciente y métricas para empresas.
   */
  dashboardEmpresa = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const usuarioId = req.usuario?.uid;
      const rol = req.usuario?.rol;

      if (!usuarioId || !rol) {
        res.status(401).json({
          exito: false,
          mensaje: 'Usuario no autenticado.',
          codigo: 401,
        });
        return;
      }

      const dashboard = await dashboardService.obtenerDashboardEmpresa(
        usuarioId,
        rol,
        req.query.empresaId as string | undefined
      );

      res.status(200).json({
        exito: true,
        mensaje: 'Dashboard de empresa obtenido correctamente.',
        datos: dashboard,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Entrega KPIs, estadísticas, actividad reciente y métricas para profesionales.
   */
  dashboardProfesional = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const usuarioId = req.usuario?.uid;
      const rol = req.usuario?.rol;

      if (!usuarioId || !rol) {
        res.status(401).json({
          exito: false,
          mensaje: 'Usuario no autenticado.',
          codigo: 401,
        });
        return;
      }

      const dashboard = await dashboardService.obtenerDashboardProfesional(
        usuarioId,
        rol,
        req.query.profesionalId as string | undefined
      );

      res.status(200).json({
        exito: true,
        mensaje: 'Dashboard profesional obtenido correctamente.',
        datos: dashboard,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Entrega KPIs, estadísticas, actividad reciente y métricas globales para administradores.
   */
  dashboardAdmin = async (_req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dashboard = await dashboardService.obtenerDashboardAdministrador();

      res.status(200).json({
        exito: true,
        mensaje: 'Dashboard administrador obtenido correctamente.',
        datos: dashboard,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const dashboardController = new DashboardController();

