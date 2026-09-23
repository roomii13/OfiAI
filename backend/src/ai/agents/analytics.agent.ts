/**
 * @archivo analytics.agent.ts
 * @descripcion Agente de análisis de datos y generación de insights para OfiAI.
 * Produce señales simples para dashboards y reportes hasta incorporar modelos predictivos.
 * @modulo AI Agents
 */

export interface EntradaInsightOperativo {
  nombreMetrica: string;
  valorActual: number;
  valorReferencia: number;
}

export interface InsightOperativo {
  titulo: string;
  severidad: 'positiva' | 'neutral' | 'alerta';
  mensaje: string;
}

/**
 * Agente analítico con reglas interpretables.
 */
class AnalyticsAgent {
  /**
   * Genera un insight comparando una métrica contra su referencia.
   */
  generarInsight(entrada: EntradaInsightOperativo): InsightOperativo {
    const diferencia = entrada.valorActual - entrada.valorReferencia;

    if (diferencia > 0) {
      return {
        titulo: `${entrada.nombreMetrica} en crecimiento`,
        severidad: 'positiva',
        mensaje: `La métrica supera la referencia por ${this.redondear(diferencia)} puntos.`,
      };
    }

    if (diferencia < 0) {
      return {
        titulo: `${entrada.nombreMetrica} requiere atención`,
        severidad: 'alerta',
        mensaje: `La métrica está ${this.redondear(Math.abs(diferencia))} puntos por debajo de la referencia.`,
      };
    }

    return {
      titulo: `${entrada.nombreMetrica} estable`,
      severidad: 'neutral',
      mensaje: 'La métrica se mantiene alineada con la referencia.',
    };
  }

  /**
   * Redondea valores de análisis.
   */
  private redondear(valor: number): number {
    return Math.round((valor + Number.EPSILON) * 100) / 100;
  }
}

export const analyticsAgent = new AnalyticsAgent();
