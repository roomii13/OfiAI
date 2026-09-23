/**
 * @archivo intake.agent.ts
 * @descripcion Agente de recepción inteligente de requerimientos para OfiAI.
 * Clasifica solicitudes para facilitar publicación, matching y estimación de precios.
 * @modulo AI Agents
 */

import {
  classificationTool,
  EntradaClasificacionSolicitud,
  ResultadoClasificacionSolicitud,
} from '../tools/classification.tool';
import { geminiClient, GeminiIntakeError } from '../../integrations/gemini/gemini.client';
import { intakeModelResponseSchema, type IntakeResult, type IntakeSession } from '../../models/intake.model';
import { intakeConversation, intakeResponseJsonSchema, intakeSystemPrompt } from '../prompts/intake.prompt';
import { assessIntake } from '../tools/intake-state.tool';

/**
 * Agente encargado de entender solicitudes entrantes de empresas.
 */
class IntakeAgent {
  /** Ejecuta extraccion real y valida el JSON antes de actualizar el estado. */
  async conversar(session: IntakeSession, message: string): Promise<IntakeResult> {
    const raw = await geminiClient.generarEstructurado(
      intakeSystemPrompt(new Date().toISOString()), intakeConversation(session, message), intakeResponseJsonSchema,
    );
    const parsed = intakeModelResponseSchema.safeParse(raw);
    if (!parsed.success) throw new GeminiIntakeError('invalid_response');
    return { ...parsed.data, ...assessIntake(parsed.data.extractedData, parsed.data.missingInformation) };
  }

  /**
   * Clasifica una solicitud textual usando reglas de dominio.
   */
  clasificarSolicitud(entrada: EntradaClasificacionSolicitud): ResultadoClasificacionSolicitud {
    return classificationTool.clasificarSolicitud(entrada);
  }
}

export const intakeAgent = new IntakeAgent();
