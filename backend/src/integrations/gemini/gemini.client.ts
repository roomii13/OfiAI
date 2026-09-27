/**
 * @archivo gemini.client.ts
 * @descripcion Fachada IA existente: Groq principal y proveedores anteriores solo mediante opt-in.
 * Encapsula disponibilidad, generación de texto, JSON y manejo de errores sin exponer claves.
 * @modulo Integrations
 */

import { GenerationConfig } from '@google/generative-ai';
import { env } from '../../config/env';
import { getGeminiModel } from '../../config/gemini';
import { logger } from '../../config/logger';
import { recordProviderUsage } from '../../monitoring/ai-usage';
import { deepSeekClient, DeepSeekError, type DeepSeekClient } from '../deepseek.client';
import { groqClient, GroqError, type GroqClient } from '../groq.client';

export interface SolicitudGemini {
  prompt: string;
  modelo?: string;
  temperatura?: number;
  maxTokens?: number;
}

export interface RespuestaGemini {
  proveedor: 'groq' | 'gemini' | 'deepseek';
  modelo: string;
  texto: string;
}

/**
 * Conserva nombre y contrato historicos; Groq precede a cualquier proveedor habilitado.
 */
export class GeminiClient {
  /** Permite inyectar transportes sin alterar los agentes consumidores. */
  constructor(private readonly transport: typeof fetch = fetch,
    private readonly principal: Pick<DeepSeekClient, 'estaDisponible' | 'generarEstructurado' | 'generarTexto'> = deepSeekClient,
    private readonly groq: Pick<GroqClient, 'estaDisponible' | 'generarEstructurado' | 'generarTexto'> = groqClient) {}

  /** Groq primero; no consume proveedores anteriores sin autorizacion de configuracion. */
  async generarEstructurado(system: string, prompt: string, schema: Record<string, unknown>,
    options: { model?: string; timeoutMs?: number; validate?: (value: unknown) => boolean } = {}): Promise<unknown> {
    let failure = new GeminiIntakeError('unavailable');
    if (this.groq.estaDisponible()) {
      try {
        const data = await this.groq.generarEstructurado(system, prompt, schema, options.timeoutMs);
        if (options.validate && !options.validate(data)) throw new GroqError('invalid_response');
        logger.info('Respuesta estructurada obtenida con Groq.');
        return data;
      } catch (error) {
        failure = new GeminiIntakeError(error instanceof GroqError ? error.reason : 'invalid_response');
        logger.warn('Groq no disponible para respuesta estructurada.', { reason: failure.reason });
      }
    }
    if (!env.AI_LEGACY_FALLBACK_ENABLED) throw failure;
    if (this.principal.estaDisponible()) {
      try {
        const data = await this.principal.generarEstructurado(system, prompt, schema, options.timeoutMs);
        if (options.validate && !options.validate(data)) throw new DeepSeekError('invalid_response');
        logger.info('Respuesta estructurada obtenida con DeepSeek.');
        return data;
      } catch (error) {
        failure = new GeminiIntakeError(error instanceof DeepSeekError ? error.reason : 'invalid_response');
        logger.warn('DeepSeek no disponible; se intenta Gemini.', { reason: failure.reason });
      }
    }
    if (env.GEMINI_API_KEY) {
      try {
        const data = await this.generarEstructuradoGemini(system, prompt, schema, options);
        if (options.validate && !options.validate(data)) throw new GeminiIntakeError('invalid_response');
        logger.info('Respuesta estructurada obtenida con Gemini de respaldo.');
        return data;
      } catch (error) {
        failure = error instanceof GeminiIntakeError ? error : new GeminiIntakeError('unavailable');
        logger.warn('Gemini de respaldo no disponible.', { reason: failure.reason });
      }
    }
    throw failure;
  }

  /** Solicita JSON con esquema, timeout real y errores sin datos del proveedor. */
  private async generarEstructuradoGemini(system: string, prompt: string, schema: Record<string, unknown>, options: { model?: string; timeoutMs?: number } = {}): Promise<unknown> {
    if (!env.GEMINI_API_KEY) throw new GeminiIntakeError('unavailable');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? env.GEMINI_INTAKE_TIMEOUT_MS);
    const started=Date.now();
    let usageRecorded=false;
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
      const payload = raw as { usageMetadata?: {promptTokenCount?: number;candidatesTokenCount?: number};
        candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
      recordProviderUsage('gemini',options.model ?? env.GEMINI_INTAKE_MODEL,payload.usageMetadata?.promptTokenCount,
        payload.usageMetadata?.candidatesTokenCount,Date.now()-started);
      usageRecorded=true;
      const candidate = payload?.candidates?.[0];
      if (candidate?.finishReason !== 'STOP') throw new GeminiIntakeError('invalid_response');
      const text = candidate.content?.parts?.filter(part => !part.thought).map(part => part.text ?? '').join('') ?? '';
      if (!text || text.length > 32000) throw new GeminiIntakeError('invalid_response');
      try { return JSON.parse(text) as unknown; }
      catch { throw new GeminiIntakeError('invalid_response'); }
    } catch (error) {
      if(!usageRecorded) recordProviderUsage('gemini',options.model ?? env.GEMINI_INTAKE_MODEL,null,null,Date.now()-started,error instanceof GeminiIntakeError ? error.reason : 'unavailable');
      if (error instanceof GeminiIntakeError) throw error;
      throw new GeminiIntakeError(controller.signal.aborted ? 'timeout' : 'unavailable');
    } finally { clearTimeout(timeout); }
  }
  /**
   * Indica si existe algun proveedor configurado y autorizado.
   */
  estaDisponible(): boolean {
    return this.groq.estaDisponible()
      || (env.AI_LEGACY_FALLBACK_ENABLED && (this.principal.estaDisponible() || Boolean(env.GEMINI_API_KEY)));
  }

  /**
   * Genera texto mediante Groq; mantiene opt-in para el fallback anterior.
   */
  async generarTexto(solicitud: SolicitudGemini): Promise<RespuestaGemini> {
    let failure = new GeminiIntakeError('unavailable');
    if (this.groq.estaDisponible()) {
      try {
        return { proveedor: 'groq', modelo: env.GROQ_MODEL,
          texto: await this.groq.generarTexto(solicitud.prompt, solicitud.maxTokens, solicitud.temperatura) };
      } catch (error) {
        failure = new GeminiIntakeError(error instanceof GroqError ? error.reason : 'unavailable');
        logger.warn('Groq no disponible para chat.', { reason: failure.reason });
      }
    }
    if (!env.AI_LEGACY_FALLBACK_ENABLED) throw failure;
    if (this.principal.estaDisponible()) {
      try {
        return { proveedor: 'deepseek', modelo: env.DEEPSEEK_MODEL,
          texto: await this.principal.generarTexto(solicitud.prompt, solicitud.maxTokens, solicitud.temperatura) };
      } catch (error) {
        failure = new GeminiIntakeError(error instanceof DeepSeekError ? error.reason : 'unavailable');
        logger.warn('DeepSeek no disponible para chat; se intenta Gemini.', { reason: failure.reason });
      }
    }
    if (!env.GEMINI_API_KEY) throw failure;
    try { return await this.generarTextoGemini(solicitud); }
    catch { throw new GeminiIntakeError('unavailable'); }
  }

  /** Conserva el SDK Gemini como proveedor secundario de texto. */
  private async generarTextoGemini(solicitud: SolicitudGemini): Promise<RespuestaGemini> {
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
    } catch {
      logger.warn('Gemini de respaldo no disponible para chat.', { reason: 'unavailable' });
      throw new GeminiIntakeError('unavailable');
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
