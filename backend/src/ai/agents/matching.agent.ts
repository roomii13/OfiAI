/**
 * @archivo matching.agent.ts
 * @descripcion Agente de emparejamiento empresa-profesional para OfiAI.
 * Orquesta el ranking determinístico inicial y deja trazabilidad para mejoras con Gemini.
 * @modulo AI Agents
 */

import { Trabajo } from '../../models/Job';
import { Profesional } from '../../models/Professional';
import { rankingTool, ResultadoRankingProfesional } from '../tools/ranking.tool';
import { geminiClient, GeminiIntakeError } from '../../integrations/gemini/gemini.client';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { MATCHING_RESPONSE_SCHEMA, MATCHING_SYSTEM_PROMPT, matchingPrompt } from '../prompts/matching.prompt';
import { semanticMatchesSchema, type SemanticMatch } from '../../validators/matching.validator';
import { matchingText, publicMatchingJob } from '../../domain/matching/matching';

/**
 * Agente de matching basado en reglas explicables.
 */
export class MatchingAgent {
  /** Enriquece solamente candidatos reales prefiltrados; un fallo mantiene el ranking propio. */
  async analyze(job: Trabajo, candidates: ResultadoRankingProfesional[]): Promise<{ matches: SemanticMatch[]; used: boolean; fallback: boolean }> {
    if (candidates.length === 0) return { matches: [], used: false, fallback: false };
    try {
      if (!env.GEMINI_MATCHING_ENABLED || !geminiClient.estaDisponible()) throw new GeminiIntakeError('unavailable');
      const expected = new Set(candidates.map(candidate => candidate.profesional.id));
      const valid = (value: unknown): boolean => {
        const result = semanticMatchesSchema.safeParse(value);
        if (!result.success) return false;
        const ids = result.data.matches.map(match => match.professionalId);
        return ids.length === expected.size && new Set(ids).size === ids.length && ids.every(id => expected.has(id));
      };
      const raw = await geminiClient.generarEstructurado(MATCHING_SYSTEM_PROMPT, matchingPrompt(publicMatchingJob(job), candidates),
        MATCHING_RESPONSE_SCHEMA, { model: env.GEMINI_MATCHING_MODEL, timeoutMs: 30000, validate: valid });
      const parsed = semanticMatchesSchema.safeParse(raw);
      if (!parsed.success) throw new GeminiIntakeError('invalid_response');
      if (!valid(parsed.data)) throw new GeminiIntakeError('invalid_response');
      return { matches: parsed.data.matches.map(match => ({ ...match, reason: matchingText(match.reason, 600),
        strengths: match.strengths.map(value => matchingText(value, 240)), concerns: match.concerns.map(value => matchingText(value, 240)) })), used: true, fallback: false };
    } catch (error) {
      logger.warn('Matching semantico no disponible; se mantienen criterios deterministas.', {
        reason: error instanceof GeminiIntakeError ? error.reason : 'invalid_response',
      });
      return { matches: [], used: false, fallback: true };
    }
  }
  /**
   * Ejecuta el ranking de profesionales candidatos para un trabajo.
   */
  recomendarProfesionales(
    trabajo: Trabajo,
    profesionales: Profesional[],
    limite: number
  ): ResultadoRankingProfesional[] {
    return rankingTool.rankearProfesionales(trabajo, profesionales, profesionales.length).filter(candidate => candidate.eligible).slice(0, limite);
  }
}

export const matchingAgent = new MatchingAgent();
