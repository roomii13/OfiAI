/** @archivo intelligence.service.ts @descripcion Respuestas analiticas basadas en evidencia tenant-safe. */
import { z } from 'zod';
import { input } from '../validators/agent.validator';
import { intelligenceRepository } from '../repositories/intelligence.repository';
import { analyzeEvidence } from '../ai/tools/analytics.tool';
import { analyticsAgent } from '../ai/agents/analytics.agent';
import type { AgentActor } from '../models/agent.model';
import type { IntelligenceAnswer } from '../../../shared/intelligence';
export const intelligenceQuestionSchema = z.object({ question: z.string().trim().min(3).max(1000),
  month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/).optional() }).strict();
/** Mantiene calculo y evidencia fuera del controlador y del modelo generativo. */
export class IntelligenceService {
  /** Snapshot actual: el tenant siempre proviene del token validado. */
  async snapshot(actor: AgentActor,month = new Date().toISOString().slice(0,7)) {
    input(z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),month);
    return analyzeEvidence(await intelligenceRepository.source(actor,month),month,actor.rol === 'admin');
  }
  /** Una pregunta selecciona evidencia; no permite ejecutar consultas arbitrarias. */
  async ask(actor: AgentActor,raw: unknown): Promise<IntelligenceAnswer> {
    const data = input(intelligenceQuestionSchema,raw); const snapshot = await this.snapshot(actor,data.month);
    return analyticsAgent.enrich(actor,analyticsAgent.answer(data.question,snapshot),snapshot);
  }
}
export const intelligenceService = new IntelligenceService();
