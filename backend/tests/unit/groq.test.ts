/** @archivo groq.test.ts @descripcion Transporte y prioridad Groq con respuestas sinteticas, sin red. */
import { GroqClient, GroqError } from '../../src/integrations/groq.client';
import { jest } from '@jest/globals';
import { GeminiClient } from '../../src/integrations/gemini/gemini.client';
import { env } from '../../src/config/env';
import { aiUsageContext, type ProviderUsage } from '../../src/monitoring/ai-usage';

const original = { ...env };
const schema = { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false };
/** Construye una respuesta del contrato Chat Completions, sin contactar al proveedor. */
function completion(content = '{"ok":true}', finish = 'stop'): Response {
  return Response.json({ choices: [{ finish_reason: finish, message: { content } }],
    usage: { prompt_tokens: 12, completion_tokens: 4 } });
}
beforeEach(() => { env.GROQ_API_KEY = 'gsk_testcredential000000000000'; env.AI_LEGACY_FALLBACK_ENABLED = false; });
afterEach(() => { Object.assign(env, original); jest.useRealTimers(); jest.restoreAllMocks(); });

it('usa JSON estricto, secreto solo en header y registra tokens observados', async () => {
  const transport = jest.fn<typeof fetch>().mockResolvedValue(completion());
  const usage: ProviderUsage[] = [];
  await expect(aiUsageContext.run(usage, () => new GroqClient(transport).generarEstructurado('Sistema',
    'Problema sin credenciales', schema))).resolves.toEqual({ ok: true });
  const [url, request] = transport.mock.calls[0]!;
  expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
  expect(request?.headers).toMatchObject({ Authorization: 'Bearer ' + env.GROQ_API_KEY });
  expect(request?.redirect).toBe('error');
  expect(String(request?.body)).not.toContain(env.GROQ_API_KEY);
  expect(JSON.parse(String(request?.body))).toMatchObject({ stream: false,
    response_format: { type: 'json_schema', json_schema: { strict: true, schema } } });
  expect(usage).toEqual([expect.objectContaining({ provider: 'groq', inputTokens: 12, outputTokens: 4, error: null })]);
});
it('redacta una clave accidental dentro del mensaje', async () => {
  const transport = jest.fn<typeof fetch>().mockResolvedValue(completion());
  await new GroqClient(transport).generarTexto('Revisar ' + env.GROQ_API_KEY);
  expect(String(transport.mock.calls[0]![1]?.body)).not.toContain(env.GROQ_API_KEY);
});
it.each(['no JSON', 'null', '[]', '42'])('rechaza JSON invalido para objeto: %s', async content => {
  const usage: ProviderUsage[] = [];
  const client = new GroqClient(jest.fn<typeof fetch>().mockResolvedValue(completion(content)));
  await expect(aiUsageContext.run(usage, () => client.generarEstructurado('s', 'p', schema)))
    .rejects.toMatchObject({ reason: 'invalid_response' });
  expect(usage[0]?.error).toBe('invalid_response');
});
it.each(['length', 'tool_calls', 'content_filter'])('rechaza finalizacion %s', async finish => {
  const client = new GroqClient(jest.fn<typeof fetch>().mockResolvedValue(completion('{}', finish)));
  await expect(client.generarEstructurado('s', 'p', schema)).rejects.toMatchObject({ reason: 'invalid_response' });
});
it.each([400, 401, 402, 403, 413, 422, 500, 503])('controla HTTP %s sin revelar errores internos', async status => {
  const client = new GroqClient(jest.fn<typeof fetch>().mockResolvedValue(new Response('secreto-del-proveedor', { status })));
  await expect(client.generarTexto('p')).rejects.toMatchObject({
    reason: [400,413,422].includes(status) ? 'invalid_response' : 'unavailable',
    message: expect.not.stringContaining('secreto-del-proveedor') });
});
it('respeta Retry-After y no reintenta hasta vencer el cooldown', async () => {
  jest.useFakeTimers();
  const transport = jest.fn<typeof fetch>().mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '2' } }))
    .mockResolvedValueOnce(completion('Hola'));
  const client = new GroqClient(transport);
  await expect(client.generarTexto('p')).rejects.toMatchObject({ reason: 'rate_limit' });
  await expect(client.generarTexto('p')).rejects.toMatchObject({ reason: 'rate_limit' });
  expect(transport).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(2001);
  await expect(client.generarTexto('p')).resolves.toBe('Hola');
  expect(transport).toHaveBeenCalledTimes(2);
});
it('aborta efectivamente al vencer el timeout', async () => {
  jest.useFakeTimers();
  const transport: typeof fetch = (_url, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new Error('cancelado')));
  });
  const assertion = expect(new GroqClient(transport).generarEstructurado('s', 'p', schema, 1000))
    .rejects.toMatchObject({ reason: 'timeout' });
  await jest.advanceTimersByTimeAsync(1001); await assertion;
});
it('no llama a red sin clave ni ante entradas excesivas', async () => {
  const transport = jest.fn<typeof fetch>(); const client = new GroqClient(transport);
  await expect(client.generarTexto('a'.repeat(env.GROQ_MAX_INPUT_CHARACTERS + 1))).rejects.toMatchObject({ reason: 'invalid_response' });
  env.GROQ_API_KEY = '';
  await expect(client.generarTexto('p')).rejects.toMatchObject({ reason: 'unavailable' });
  expect(transport).not.toHaveBeenCalled();
});
it('prefiere Groq para chat y JSON, incluso con el respaldo habilitado', async () => {
  env.AI_LEGACY_FALLBACK_ENABLED = true;
  const legacy = { estaDisponible: jest.fn(() => true), generarTexto: jest.fn<GroqClient['generarTexto']>(), generarEstructurado: jest.fn<GroqClient['generarEstructurado']>() };
  const transport = jest.fn<typeof fetch>();
  const groq = new GroqClient(jest.fn<typeof fetch>().mockImplementation(async () => completion()));
  const client = new GeminiClient(transport, legacy, groq);
  await expect(client.generarEstructurado('s', 'p', schema)).resolves.toEqual({ ok: true });
  await expect(client.generarTexto({ prompt: 'p' })).resolves.toMatchObject({ proveedor: 'groq' });
  expect(legacy.generarTexto).not.toHaveBeenCalled(); expect(legacy.generarEstructurado).not.toHaveBeenCalled();
  expect(transport).not.toHaveBeenCalled();
});
it('no consume proveedores anteriores si Groq falla o no tiene clave', async () => {
  const legacy = { estaDisponible: jest.fn(() => true), generarTexto: jest.fn<GroqClient['generarTexto']>(), generarEstructurado: jest.fn<GroqClient['generarEstructurado']>() };
  const transport = jest.fn<typeof fetch>();
  const groq = { estaDisponible: () => true, generarTexto: jest.fn<GroqClient['generarTexto']>().mockRejectedValue(new GroqError('rate_limit')),
    generarEstructurado: jest.fn<GroqClient['generarEstructurado']>().mockRejectedValue(new GroqError('rate_limit')) };
  const client = new GeminiClient(transport, legacy, groq);
  await expect(client.generarTexto({ prompt: 'p' })).rejects.toMatchObject({ reason: 'rate_limit' });
  await expect(client.generarEstructurado('s', 'p', schema)).rejects.toMatchObject({ reason: 'rate_limit' });
  expect(transport).not.toHaveBeenCalled(); expect(legacy.generarTexto).not.toHaveBeenCalled();
  expect(legacy.generarEstructurado).not.toHaveBeenCalled();
  expect(new GeminiClient(transport, legacy, { ...groq, estaDisponible: () => false }).estaDisponible()).toBe(false);
});
it('valida reglas de dominio despues del JSON sin aceptar resultados inventados', async () => {
  const client = new GeminiClient(undefined, undefined, new GroqClient(jest.fn<typeof fetch>().mockResolvedValue(completion())));
  await expect(client.generarEstructurado('s', 'p', schema, { validate: () => false }))
    .rejects.toMatchObject({ reason: 'invalid_response' });
});
