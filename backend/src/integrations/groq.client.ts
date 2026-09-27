/**
 * @archivo groq.client.ts
 * @descripcion Transporte Groq exclusivo del backend, con JSON estricto y errores seguros.
 */
import { z } from 'zod';
import { env } from '../config/env';
import { recordProviderUsage } from '../monitoring/ai-usage';
import { redactSecrets } from '../utils/agent-text';

const usageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative().optional(),
  completion_tokens: z.number().int().nonnegative().optional(),
});
const completionSchema = z.object({
  choices: z.array(z.object({
    finish_reason: z.string().nullable(),
    message: z.object({
      content: z.string().max(32000).nullable(),
      refusal: z.string().nullable().optional(),
    }),
  })).min(1),
});

/** Clasificacion compartida por los agentes; nunca conserva cuerpos ni credenciales. */
export class GroqError extends Error {
  /** Conserva solo el motivo publico y estable del fallo. */
  constructor(public readonly reason: 'unavailable' | 'timeout' | 'rate_limit' | 'invalid_response') {
    super(reason);
    this.name = 'GroqError';
  }
}

/** API alojada; no instala modelos ni necesita hardware del usuario. */
export class GroqClient {
  private blockedUntil = 0;

  /** Transporte inyectable; no crea conexiones al importar el modulo. */
  constructor(private readonly transport: typeof fetch = fetch) {}

  /** Presencia de configuracion, no confirmacion de saldo ni del plan de la cuenta. */
  estaDisponible(): boolean { return Boolean(env.GROQ_API_KEY); }

  /** Solicita el esquema completo; cada agente valida tambien datos y reglas de dominio. */
  async generarEstructurado(system: string, prompt: string, schema: Record<string, unknown>,
    timeoutMs = env.GROQ_TIMEOUT_MS): Promise<unknown> {
    const text = await this.complete(system + '\nDevolve solamente el JSON del esquema solicitado.',
      prompt, env.GROQ_MAX_OUTPUT_TOKENS, 0.2, timeoutMs, schema);
    return JSON.parse(text) as unknown;
  }

  /** Chat textual sin herramientas remotas, busquedas ni acciones autonomas. */
  async generarTexto(prompt: string, maxTokens = 1024, temperatura = 0.2): Promise<string> {
    return this.complete('Sos el asistente de OfiAI. Responde en espanol con claridad, sin inventar datos ni revelar secretos.',
      prompt, maxTokens, temperatura, env.GROQ_TIMEOUT_MS);
  }

  /** Respeta Retry-After sin bucles de reintento que agoten cuotas del proveedor. */
  private pauseAfterLimit(value: string | null): void {
    const seconds = value === null ? NaN : Number(value);
    const duration = Number.isFinite(seconds) ? seconds * 1000 : value ? Date.parse(value) - Date.now() : NaN;
    this.blockedUntil = Date.now() + Math.min(86400000, Math.max(1000, Number.isFinite(duration) ? duration : 60000));
  }

  /** Una solicitud por invocacion; rechaza truncamiento, refusals y respuestas invalidas. */
  private async complete(system: string, prompt: string, maxTokens: number, temperature: number,
    timeoutMs: number, schema?: Record<string, unknown>): Promise<string> {
    if (!this.estaDisponible()) throw new GroqError('unavailable');
    if (Date.now() < this.blockedUntil) throw new GroqError('rate_limit');
    if (!Number.isFinite(maxTokens) || !Number.isFinite(temperature) || !Number.isFinite(timeoutMs)
      || !prompt.trim() || system.length + prompt.length > env.GROQ_MAX_INPUT_CHARACTERS)
      throw new GroqError('invalid_response');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.max(1000, Math.min(timeoutMs, env.GROQ_TIMEOUT_MS)));
    const started = Date.now();
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let failure: GroqError['reason'] | null = null;
    try {
      const response = await this.transport('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', signal: controller.signal, redirect: 'error',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.GROQ_API_KEY },
        body: JSON.stringify({
          model: env.GROQ_MODEL,
          messages: [{ role: 'system', content: redactSecrets(system) }, { role: 'user', content: redactSecrets(prompt) }],
          temperature: Math.min(2, Math.max(0, temperature)),
          max_completion_tokens: Math.max(1, Math.min(Math.trunc(maxTokens), env.GROQ_MAX_OUTPUT_TOKENS)),
          ...(env.GROQ_MODEL.startsWith('qwen/') ? { reasoning_effort: 'none', reasoning_format: 'hidden' } : {}),
          ...(schema ? { response_format: { type: 'json_schema',
            json_schema: { name: 'ofiai_response', strict: true, schema } } } : {}),
          stream: false,
        }),
      });
      if (response.status === 429) {
        this.pauseAfterLimit(response.headers.get('retry-after'));
        throw new GroqError('rate_limit');
      }
      if (!response.ok) throw new GroqError(response.status === 400 || response.status === 413 || response.status === 422
        ? 'invalid_response' : 'unavailable');
      const raw: unknown = await response.json();
      const usage = z.object({ usage: usageSchema.optional() }).safeParse(raw);
      if (usage.success) {
        inputTokens = usage.data.usage?.prompt_tokens;
        outputTokens = usage.data.usage?.completion_tokens;
      }
      const parsed = completionSchema.safeParse(raw);
      if (!parsed.success) throw new GroqError('invalid_response');
      const choice = parsed.data.choices[0]!;
      if (choice.finish_reason !== 'stop' || choice.message.refusal || !choice.message.content?.trim())
        throw new GroqError('invalid_response');
      if (schema) {
        const structured: unknown = JSON.parse(choice.message.content);
        if (!structured || typeof structured !== 'object' || Array.isArray(structured))
          throw new GroqError('invalid_response');
      }
      return choice.message.content;
    } catch (error) {
      const safeError = error instanceof GroqError ? error
        : new GroqError(controller.signal.aborted ? 'timeout' : error instanceof SyntaxError ? 'invalid_response' : 'unavailable');
      failure = safeError.reason;
      throw safeError;
    } finally {
      clearTimeout(timeout);
      recordProviderUsage('groq', env.GROQ_MODEL, inputTokens, outputTokens, Date.now() - started, failure);
    }
  }
}

export const groqClient = new GroqClient();
