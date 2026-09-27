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
import { z } from 'zod';
import { businessAi } from '../tools/business-ai.tool';
import { ANALYTICS_PROMPT,BUSINESS_PROMPT_VERSION } from '../prompts/business.prompts';
import type { AgentActor } from '../../models/agent.model';

export interface InsightOperativo {
  titulo: string;
  severidad: 'positiva' | 'neutral' | 'alerta';
  mensaje: string;
}

/**
 * Agente analítico con reglas interpretables.
 */
class AnalyticsAgent {
  /** Usa IA para seleccionar evidencia existente; no acepta cifras o conclusiones generadas. */
  async enrich(actor: AgentActor,answer: import('../../../../shared/intelligence').IntelligenceAnswer,
    snapshot: import('../../../../shared/intelligence').IntelligenceSnapshot) {
    const schema=z.object({ids: z.array(z.string()).min(1).max(8)}).strict();
    const result=await businessAi({actor,agent: 'analytics',promptVersion: BUSINESS_PROMPT_VERSION,system: ANALYTICS_PROMPT,
      data: {question: answer.question,facts: snapshot.facts},schema,fallback: {ids: answer.facts.map(fact=>fact.id)},
      validate: value=>new Set(value.ids).size===value.ids.length && value.ids.every(id=>snapshot.facts.some(fact=>fact.id===id)),
      jsonSchema: {type: 'object',properties: {ids: {type: 'array',items: {type: 'string'}}},required: ['ids'],additionalProperties: false}});
    return {...answer,facts: result.value.ids.map(id=>snapshot.facts.find(fact=>fact.id===id)!),
      method: result.usedAi?'structured_ai' as const:'rules' as const};
  }
  /** Explica evidencia, distingue alertas de predicciones y mantiene las limitaciones. */
  answer(question: string,snapshot: import('../../../../shared/intelligence').IntelligenceSnapshot): import('../../../../shared/intelligence').IntelligenceAnswer {
    const q = question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    let facts = snapshot.facts.filter(fact => fact.value !== null).slice(0,8);
    let answer = 'Este es el resumen de la evidencia registrada.';
    if (/gaste|gasto|ingreso|revenue|mrr|arr/.test(q)) facts = snapshot.facts.filter(fact => fact.unit === 'money');
    if (/rentab|ganancia/.test(q)) { facts = snapshot.facts.filter(fact => fact.id === 'category_profitability'); answer = 'No puedo calcular rentabilidad sin costos y cobros por trabajo.'; }
    if (/demor|retras/.test(q)) { facts = snapshot.facts.filter(fact => fact.id.startsWith('jobs_delayed') || fact.id === 'delay_probability');
      answer = snapshot.delayed.length ? 'Hay trabajos con fechas superadas. Eso es una alerta, no prueba la causa ni una probabilidad de retraso.'
        : 'No aparecen fechas superadas dentro de los trabajos consultados. Las solicitudes sin fecha no permiten evaluar demoras.'; }
    if (/categoria|solicitud|demanda/.test(q) && !/rentab/.test(q)) answer = snapshot.categories.length
      ? 'La categoria con mas solicitudes observadas es ' + snapshot.categories[0]!.name + ', con ' + snapshot.categories[0]!.jobs + ' trabajos.' : 'No hay solicitudes para comparar categorias.';
    if (/profesional|rendimiento/.test(q)) answer = snapshot.professionals.length
      ? 'El mayor numero de trabajos completados observados es ' + snapshot.professionals[0]!.completed + '. Esto no mide calidad, puntualidad ni satisfaccion.' : 'No hay trabajos completados asignados para comparar rendimiento.';
    if (/ciudad|oferta/.test(q)) answer = 'La distribucion por ciudad muestra demanda registrada y oferta disponible. Sin series historicas no puede afirmarse crecimiento.';
    if (/churn|retencion|conversion|cac|ltv|roi/.test(q)) facts = snapshot.facts.filter(fact => /churn|retention|conversion|cac|ltv|roi/.test(fact.id));
    return {question,answer,facts,limitations: [snapshot.partial ? 'Datos parciales por limite de lectura.' : 'Datos registrados al momento de la consulta.',
      'No se infieren causas ni metricas sin evidencia.'],snapshotAt: snapshot.generatedAt,method: 'rules'};
  }
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
