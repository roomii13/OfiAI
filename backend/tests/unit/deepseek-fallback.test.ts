/** @archivo deepseek-fallback.test.ts @descripcion Prioridad, validacion y fallback seguro entre proveedores IA. */
import { env } from '../../src/config/env';
import { DeepSeekClient } from '../../src/integrations/deepseek.client';
import { GeminiClient } from '../../src/integrations/gemini/gemini.client';

const previous = { deepseek: env.DEEPSEEK_API_KEY, gemini: env.GEMINI_API_KEY, fallback: env.AI_LEGACY_FALLBACK_ENABLED };
beforeEach(() => { env.DEEPSEEK_API_KEY = 'deepseek-test-only'; env.GEMINI_API_KEY = 'gemini-test-only'; env.AI_LEGACY_FALLBACK_ENABLED = true; });
afterEach(() => { env.DEEPSEEK_API_KEY = previous.deepseek; env.GEMINI_API_KEY = previous.gemini; env.AI_LEGACY_FALLBACK_ENABLED = previous.fallback; });

/** Respuesta DeepSeek sintética que conserva el contrato de Chat Completions. */
function deepResponse(content: string, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content } }] }), { status });
}
/** Respuesta Gemini sintética para generación JSON con esquema. */
function geminiResponse(content: string, status = 200): Response {
  return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: content }] } }] }), { status });
}

it('prefiere DeepSeek, pide JSON y nunca envia claves en el cuerpo', async () => {
  const deepTransport = jest.fn<Promise<Response>, Parameters<typeof fetch>>(async () => deepResponse('{"message":"listo"}'));
  const geminiTransport = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
  const client = new GeminiClient(geminiTransport, new DeepSeekClient(deepTransport));
  const result = await client.generarEstructurado('Sistema', 'Solicitud', { type: 'object' },
    { validate: value => typeof (value as { message?: unknown }).message === 'string' });
  expect(result).toEqual({ message: 'listo' });
  expect(geminiTransport).not.toHaveBeenCalled();
  expect(deepTransport).toHaveBeenCalledTimes(1);
  const [url, init] = deepTransport.mock.calls[0];
  expect(url).toBe('https://api.deepseek.com/chat/completions');
  expect(init?.headers).toMatchObject({ Authorization: 'Bearer deepseek-test-only' });
  expect(JSON.stringify(init?.body)).not.toContain('deepseek-test-only');
  expect(JSON.parse(String(init?.body))).toMatchObject({ model: env.DEEPSEEK_MODEL, response_format: { type: 'json_object' } });
});

it('usa Gemini si DeepSeek devuelve un esquema incompatible', async () => {
  const deepTransport = jest.fn<Promise<Response>, Parameters<typeof fetch>>(async () => deepResponse('{}'));
  const geminiTransport = jest.fn<Promise<Response>, Parameters<typeof fetch>>(async () => geminiResponse('{"message":"respaldo"}'));
  const client = new GeminiClient(geminiTransport, new DeepSeekClient(deepTransport));
  const result = await client.generarEstructurado('Sistema', 'Solicitud', { type: 'object' },
    { validate: value => typeof (value as { message?: unknown }).message === 'string' });
  expect(result).toEqual({ message: 'respaldo' });
  expect(geminiTransport).toHaveBeenCalledTimes(1);
});

it('usa Gemini si DeepSeek agota el limite de API', async () => {
  const deepTransport = jest.fn<Promise<Response>, Parameters<typeof fetch>>(async () => deepResponse('', 429));
  const geminiTransport = jest.fn<Promise<Response>, Parameters<typeof fetch>>(async () => geminiResponse('{"ok":true}'));
  const result = await new GeminiClient(geminiTransport, new DeepSeekClient(deepTransport))
    .generarEstructurado('Sistema', 'Solicitud', { type: 'object' });
  expect(result).toEqual({ ok: true });
});

it('no revela respuestas internas cuando ambos proveedores fallan', async () => {
  const deepTransport = jest.fn<Promise<Response>, Parameters<typeof fetch>>(async () => deepResponse('secreto-interno', 503));
  const geminiTransport = jest.fn<Promise<Response>, Parameters<typeof fetch>>(async () => geminiResponse('secreto-interno', 503));
  await expect(new GeminiClient(geminiTransport, new DeepSeekClient(deepTransport))
    .generarEstructurado('Sistema', 'Solicitud', {})).rejects.toMatchObject({ reason: 'unavailable' });
});

it('usa DeepSeek primero para chat sin invocar Gemini', async () => {
  const deepTransport = jest.fn<Promise<Response>, Parameters<typeof fetch>>(async () => deepResponse('Te ayudo con tu solicitud.'));
  const geminiTransport = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
  const result = await new GeminiClient(geminiTransport, new DeepSeekClient(deepTransport))
    .generarTexto({ prompt: 'Necesito ayuda', maxTokens: 100 });
  expect(result).toMatchObject({ proveedor: 'deepseek', texto: 'Te ayudo con tu solicitud.' });
  expect(geminiTransport).not.toHaveBeenCalled();
});
