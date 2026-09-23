/**
 * @archivo intake-gemini.test.ts
 * @descripcion Fallos de Gemini con transporte simulado, sin red ni claves productivas.
 */
import { GeminiClient } from '../../src/integrations/gemini/gemini.client';
import { env } from '../../src/config/env';
const original = env.GEMINI_API_KEY;
beforeEach(() => { env.GEMINI_API_KEY = 'test-only-secret'; });
afterEach(() => { env.GEMINI_API_KEY = original; jest.useRealTimers(); });

it('envia clave solo en headers y pide JSON con esquema', async () => {
  const transport = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>().mockResolvedValue(new Response(JSON.stringify({
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"ok":true}' }] } }],
  })));
  const result = await new GeminiClient(transport).generarEstructurado('sistema', 'datos', { type: 'object' });
  expect(result).toEqual({ ok: true });
  expect(String(transport.mock.calls[0][0])).not.toContain('test-only-secret');
  expect(JSON.parse(String(transport.mock.calls[0][1]?.body)).generationConfig.responseMimeType).toBe('application/json');
});
it.each([['no JSON', 'STOP'], ['{}', 'MAX_TOKENS']])('rechaza respuesta invalida sin filtrar contenido: %s', async (text, finishReason) => {
  const transport = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason, content: { parts: [{ text }] } }] })));
  await expect(new GeminiClient(transport).generarEstructurado('s', 'p', {})).rejects.toMatchObject({ reason: 'invalid_response' });
});
it.each([[429, 'rate_limit'], [402, 'unavailable'], [503, 'unavailable']])('controla HTTP %s', async (status, reason) => {
  const transport = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>().mockResolvedValue(new Response('provider-secret', { status: Number(status) }));
  await expect(new GeminiClient(transport).generarEstructurado('s', 'p', {})).rejects.toMatchObject({ reason });
});
it('aborta por timeout sin esperar indefinidamente', async () => {
  jest.useFakeTimers();
  const transport: typeof fetch = (_url, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new Error('abort')));
  });
  const call = new GeminiClient(transport).generarEstructurado('s', 'p', {});
  const assertion = expect(call).rejects.toMatchObject({ reason: 'timeout' });
  await jest.advanceTimersByTimeAsync(env.GEMINI_INTAKE_TIMEOUT_MS);
  await assertion;
});
it('no realiza solicitudes sin credencial', async () => {
  env.GEMINI_API_KEY = ''; const transport = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
  await expect(new GeminiClient(transport).generarEstructurado('s', 'p', {})).rejects.toMatchObject({ reason: 'unavailable' });
  expect(transport).not.toHaveBeenCalled();
});
