/** @archivo deepseek.client.ts @descripcion Proveedor IA principal, aislado del frontend y de las claves de otros servicios. */
import { env } from '../config/env';
import { recordProviderUsage } from '../monitoring/ai-usage';

/** Fallos seguros para registrar sin incluir prompts, claves ni respuestas crudas. */
export class DeepSeekError extends Error {
  /** Clasifica errores recuperables del proveedor. */
  constructor(public readonly reason: 'unavailable' | 'timeout' | 'rate_limit' | 'invalid_response') {
    super(reason);
    this.name = 'DeepSeekError';
  }
}

/** Cliente HTTP compatible con Chat Completions y JSON Output de DeepSeek. */
export class DeepSeekClient {
  /** Permite inyectar transporte en pruebas sin tráfico real. */
  constructor(private readonly transport: typeof fetch = fetch) {}

  /** Indica si hay credencial exclusivamente en backend. */
  estaDisponible(): boolean { return Boolean(env.DEEPSEEK_API_KEY); }

  /** Pide un objeto JSON; el agente consumidor debe validar su esquema de dominio. */
  async generarEstructurado(system: string, prompt: string, schema: Record<string, unknown>, timeoutMs = env.DEEPSEEK_TIMEOUT_MS): Promise<unknown> {
    const texto = await this.complete(system + '\nResponde solo JSON valido conforme a este esquema JSON: ' + JSON.stringify(schema),
      prompt, true, timeoutMs, 8192, 0.2);
    try {
      const parsed: unknown = JSON.parse(texto);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('No es un objeto JSON.');
      return parsed;
    } catch { throw new DeepSeekError('invalid_response'); }
  }

  /** Genera una respuesta textual para el chat autenticado. */
  async generarTexto(prompt: string, maxTokens = 1024, temperatura = 0.2): Promise<string> {
    return this.complete('Sos el asistente de OfiAI. Responde con claridad y no inventes datos.', prompt,
      false, env.DEEPSEEK_TIMEOUT_MS, maxTokens, temperatura);
  }

  /** Transporta una sola solicitud, sin exponer cuerpo ni cabeceras en errores. */
  private async complete(system: string, prompt: string, json: boolean, timeoutMs: number, maxTokens: number, temperatura: number): Promise<string> {
    if (!this.estaDisponible()) throw new DeepSeekError('unavailable');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const started=Date.now();
    let usageRecorded=false;
    try {
      const response = await this.transport('https://api.deepseek.com/chat/completions', {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.DEEPSEEK_API_KEY },
        body: JSON.stringify({ model: env.DEEPSEEK_MODEL, messages: [
          { role: 'system', content: system }, { role: 'user', content: prompt },
        ], thinking: { type: 'disabled' }, temperature: temperatura, max_tokens: maxTokens,
        ...(json ? { response_format: { type: 'json_object' } } : {}), stream: false }),
      });
      if (!response.ok) throw new DeepSeekError(response.status === 429 ? 'rate_limit' : 'unavailable');
      const raw: unknown = await response.json();
      const payload = raw as { usage?: {prompt_tokens?: number; completion_tokens?: number};
        choices?: Array<{ finish_reason?: string; message?: { content?: unknown } }> };
      recordProviderUsage('deepseek',env.DEEPSEEK_MODEL,payload.usage?.prompt_tokens,payload.usage?.completion_tokens,Date.now()-started);
      usageRecorded=true;
      const choice = payload?.choices?.[0];
      const texto = choice?.message?.content;
      if (choice?.finish_reason !== 'stop' || typeof texto !== 'string' || !texto.trim() || texto.length > 32000)
        throw new DeepSeekError('invalid_response');
      return texto;
    } catch (error) {
      if(!usageRecorded) recordProviderUsage('deepseek',env.DEEPSEEK_MODEL,null,null,Date.now()-started,error instanceof DeepSeekError ? error.reason : 'unavailable');
      if (error instanceof DeepSeekError) throw error;
      throw new DeepSeekError(controller.signal.aborted ? 'timeout' : 'unavailable');
    } finally { clearTimeout(timeout); }
  }
}

export const deepSeekClient = new DeepSeekClient();
