/**
 * @archivo analytics.worker.ts
 * @descripcion Worker de procesamiento de analytics para OfiAI.
 * Calcula métricas de negocio, uso de IA y revenue de forma asíncrona.
 * @modulo Workers
 */
import { PeriodoAnalytics, ReporteAnalytics } from '../models/analytics.model';
import { analyticsService } from '../services/analytics.service';

/**
 * Genera y guarda un reporte periódico de Analytics.
 */
export const analyticsWorker = async (periodo: PeriodoAnalytics): Promise<ReporteAnalytics> => {
  return analyticsService.generarReporte(periodo);
};
