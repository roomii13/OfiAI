/**
 * @archivo gemini.client.ts
 * @descripcion Cliente de aplicación para Google Gemini usado por los módulos IA de OfiAI.
 * Encapsula disponibilidad, generación de texto, JSON y manejo de errores del SDK.
 * @modulo Integrations
 */

import { GenerationConfig } from '@google/generative-ai';
import { env } from '../../config/env';
import { getGeminiModel } from '../../config/gemini';
import { logger } from '../../config/logger';

export interface SolicitudGemini {
  prompt: string;
  modelo?: string;
  temperatura?: number;
  maxTokens?: number;
}

export interface RespuestaGemini {
  proveedor: 'gemini';
  modelo: string;
  texto: string;
}

/**
 * Cliente del proveedor Gemini con fallback explícito cuando no está configurado.
 */
export class GeminiClient {
  /** Permite probar fallos del proveedor sin enviar datos reales. */
  constructor(private readonly transport: typeof fetch = fetch) {}

  /** Solicita JSON con esquema, timeout real y errores sin datos del proveedor. */
  async generarEstructurado(system: string, prompt: string, schema: Record<string, unknown>, options: { model?: string; timeoutMs?: number } = {}): Promise<unknown> {
    if (!this.estaDisponible()) throw new GeminiIntakeError('unavailable');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? env.GEMINI_INTAKE_TIMEOUT_MS);
    try {
      const response = await this.transport(
        `https://generativelanguage.googleapis.com/v1beta/models/${options.model ?? env.GEMINI_INTAKE_MODEL}:generateContent`,
        {
          method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: 'application/json', responseJsonSchema: schema },
          }),
        },
      );
      if (!response.ok) throw new GeminiIntakeError(response.status === 429 ? 'rate_limit' : 'unavailable');
      const raw: unknown = await response.json();
      const payload = raw as { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
      const candidate = payload?.candidates?.[0];
      if (candidate?.finishReason !== 'STOP') throw new GeminiIntakeError('invalid_response');
      const text = candidate.content?.parts?.filter(part => !part.thought).map(part => part.text ?? '').join('') ?? '';
      if (!text || text.length > 32000) throw new GeminiIntakeError('invalid_response');
      try { return JSON.parse(text) as unknown; }
      catch { throw new GeminiIntakeError('invalid_response'); }
    } catch (error) {
      if (error instanceof GeminiIntakeError) throw error;
      throw new GeminiIntakeError(controller.signal.aborted ? 'timeout' : 'unavailable');
    } finally { clearTimeout(timeout); }
  }
  /**
   * Indica si el cliente cuenta con credenciales para invocar Gemini.
   */
  estaDisponible(): boolean {
    return Boolean(env.GEMINI_API_KEY);
  }

  /**
   * Genera texto usando Gemini con configuración acotada por solicitud.
   */
  async generarTexto(solicitud: SolicitudGemini): Promise<RespuestaGemini> {
    if (!this.estaDisponible()) {
      throw new Error('Gemini no está configurado. Define GEMINI_API_KEY para usar generación externa.');
    }

    try {
      const generationConfig: Partial<GenerationConfig> = {
        temperature: solicitud.temperatura ?? 0.2,
        maxOutputTokens: solicitud.maxTokens ?? 1024,
      };
      const modelo = solicitud.modelo ?? env.GEMINI_MODEL;
      const model = getGeminiModel(modelo, generationConfig);
      const result = await model.generateContent(solicitud.prompt);
      const response = await result.response;

      return {
        proveedor: 'gemini',
        modelo,
        texto: response.text(),
      };
    } catch (error) {
      logger.error('Error al generar contenido con Gemini.', { error });
      throw error;
    }
  }

  /**
   * Genera texto y parsea JSON de forma segura para integraciones futuras.
   */
  async generarJson<T>(solicitud: SolicitudGemini): Promise<T> {
    const respuesta = await this.generarTexto(solicitud);
    const textoLimpio = respuesta.texto.replace(/```json|```/g, '').trim();
    return JSON.parse(textoLimpio) as T;
  }
}

export const geminiClient = new GeminiClient();

/** Error acotado que nunca incorpora URL, clave, prompt ni respuesta del proveedor. */
export class GeminiIntakeError extends Error {
  /** Clasifica fallos para ofrecer reintentos seguros al usuario. */
  constructor(public readonly reason: 'unavailable' | 'timeout' | 'rate_limit' | 'invalid_response') {
    super(reason);
    this.name = 'GeminiIntakeError';
  }
}
