/**
 * @archivo analytics.controller.ts
 * @descripcion Controlador HTTP para Analytics de OfiAI.
 * Expone KPIs, estadísticas, reportes, exportaciones y registro de eventos.
 * @modulo Controllers
 */

import { Response, NextFunction } from 'express';
import { RequestAutenticada } from '../middleware/auth.middleware';
import { ApiError } from '../middleware/error.middleware';
import { analyticsService } from '../services/analytics.service';
import {
  DatosConsultaAnalytics,
  DatosExportarReporteAnalytics,
  DatosGenerarReporteAnalytics,
  DatosRegistrarEventoAnalytics,
} from '../validators/analytics.validator';

/**
 * Controlador de Analytics.
 */
class AnalyticsController {
  /**
   * Registra un evento de producto o negocio.
   */
  registrarEvento = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contexto = this.obtenerContextoAutenticado(req);
      const resultado = await analyticsService.registrarEvento(
        req.body as DatosRegistrarEventoAnalytics,
        contexto.usuarioId,
        contexto.rol
      );

      res.status(201).json({
        exito: true,
        mensaje: 'Evento de Analytics registrado correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Obtiene KPIs de plataforma.
   */
  obtenerKpis = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resultado = await analyticsService.obtenerKpis(req.query as unknown as DatosConsultaAnalytics);

      res.status(200).json({
        exito: true,
        mensaje: 'KPIs obtenidos correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Obtiene estadísticas de uso.
   */
  obtenerEstadisticasUso = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const resultado = await analyticsService.obtenerEstadisticasUso(req.query as unknown as DatosConsultaAnalytics);

      res.status(200).json({
        exito: true,
        mensaje: 'Estadísticas de uso obtenidas correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Genera un reporte persistido de Analytics.
   */
  generarReporte = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const datos = req.body as DatosGenerarReporteAnalytics;
      const resultado = await analyticsService.generarReporte(datos.periodo);

      res.status(201).json({
        exito: true,
        mensaje: 'Reporte de Analytics generado correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Exporta un reporte como JSON o CSV.
   */
  exportarReporte = async (req: RequestAutenticada, res: Response, next: NextFunction): Promise<void> => {
    try {
      const datos = req.query as unknown as DatosExportarReporteAnalytics;
      const resultado = await analyticsService.exportarReporte(req.params.id!, datos.formato);

      res.status(200).json({
        exito: true,
        mensaje: 'Reporte exportado correctamente.',
        datos: resultado,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Extrae contexto autenticado desde el request.
   */
  private obtenerContextoAutenticado(req: RequestAutenticada): { usuarioId: string; rol: NonNullable<RequestAutenticada['usuario']>['rol'] } {
    const usuarioId = req.usuario?.uid;
    const rol = req.usuario?.rol;

    if (!usuarioId || !rol) {
      throw new ApiError('Usuario no autenticado.', 401);
    }

    return { usuarioId, rol };
  }
}

export const analyticsController = new AnalyticsController();
