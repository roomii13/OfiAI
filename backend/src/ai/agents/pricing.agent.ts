/** @archivo pricing.agent.ts @descripcion Agente de pricing: calculo determinista y analisis estructurado opcional. */
import type { ComplejidadSolicitud } from '../tools/classification.tool';
import type { Trabajo } from '../../models/Job';
import type { PricingInputs, PricingEstimate } from '../../models/pricing.model';
import { geminiClient, GeminiIntakeError } from '../../integrations/gemini/gemini.client';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { matchingText } from '../../domain/matching/matching';
import { pricingSemanticSchema } from '../../validators/pricing.validator';
import { PRICING_SYSTEM_PROMPT, PRICING_RESPONSE_SCHEMA, pricingPrompt } from '../prompts/pricing.prompt';
export interface EntradaEstimacionPrecio { categoria: string; complejidad?: ComplejidadSolicitud; ciudad?: string; moneda?: string }
export interface ResultadoEstimacionPrecio { moneda: string; minimo: number | null; maximo: number | null; sugerido: number | null; confianza: number; factores: string[]; estado: 'informacion_insuficiente' }
/** Reutiliza el cliente existente. Gemini no cambia rangos, evidencia ni confianza. */
export class PricingAgent {
  /** El endpoint legacy no dispone de evidencia suficiente para entregar importes seguros. */
  estimarPrecio(entrada: EntradaEstimacionPrecio): ResultadoEstimacionPrecio {
    return { moneda: entrada.moneda ?? 'USD', minimo: null, maximo: null, sugerido: null, confianza: 0,
      estado: 'informacion_insuficiente', factores: ['La categoria sola no permite estimar un precio.',
        'Vincula un Job y referencias reales mediante /jobs/:id/pricing.'] };
  }
  /** Enriquece una estimacion sin exponer IDs privados ni permitir cifras inventadas. */
  async analyze(job: Trabajo, inputs: PricingInputs | null, estimate: PricingEstimate): Promise<PricingEstimate> {
    if (!inputs || !estimate.range) return estimate;
    try {
      if (!env.GEMINI_PRICING_ENABLED || !geminiClient.estaDisponible()) throw new GeminiIntakeError('unavailable');
      const raw = await geminiClient.generarEstructurado(PRICING_SYSTEM_PROMPT, pricingPrompt(job, inputs, estimate),
        PRICING_RESPONSE_SCHEMA, { model: env.GEMINI_PRICING_MODEL, timeoutMs: 20000 });
      const parsed = pricingSemanticSchema.safeParse(raw);
      if (!parsed.success) throw new GeminiIntakeError('invalid_response');
      const validIds = new Set(estimate.evidence.map((_e, i) => 'e' + i));
      if (new Set(parsed.data.evidenceIds).size !== parsed.data.evidenceIds.length || parsed.data.evidenceIds.some(id => !validIds.has(id))) throw new GeminiIntakeError('invalid_response');
      const texts = [parsed.data.summary, ...parsed.data.questions, ...parsed.data.cautions];
      if (texts.some(text => /\b(?:USD|ARS|EUR)\b|[$€]|\d+[.,]?\d*\s*%/i.test(text))) throw new GeminiIntakeError('invalid_response');
      return { ...estimate, semanticUsed: true, analysis: matchingText(parsed.data.summary, 700),
        warnings: [...estimate.warnings, ...parsed.data.cautions.map(text => matchingText(text, 200))],
        assumptions: [...estimate.assumptions, ...parsed.data.questions.map(text => 'Por confirmar con IA: ' + matchingText(text, 200))] };
    } catch (error) {
      logger.warn('Pricing semantico no disponible; calculo determinista conservado.', { reason: error instanceof GeminiIntakeError ? error.reason : 'invalid_response' });
      return { ...estimate, fallbackUsed: true, warnings: [...estimate.warnings, 'Analisis semantico no disponible. Estimacion calculada con referencias y reglas de compatibilidad.'] };
    }
  }
}
export const pricingAgent = new PricingAgent();
