/** @archivo pricing.test.ts @descripcion Calculo, incompatibilidades, atipicos y degradacion segura de Gemini. */
import { calculatePricing, comparable, robustValues } from '../../src/ai/tools/pricing.tool';
import { pricingAgent } from '../../src/ai/agents/pricing.agent';
import { geminiClient, GeminiIntakeError } from '../../src/integrations/gemini/gemini.client';
import { aiProviderCacheConfig, env } from '../../src/config/env';
import { pricingFingerprint } from '../../src/domain/pricing/pricing';
import { pricingInputsSchema, pricingQuoteSchema } from '../../src/validators/pricing.validator';
import { matchingJob } from '../matching-fixtures';
import { pricingInputs, pricingQuote, pricingEvidence } from '../pricing-fixtures';
const job = matchingJob({ urgency: 'normal' });
const providerConfig = { GROQ_API_KEY: env.GROQ_API_KEY, GROQ_MODEL: env.GROQ_MODEL,
  AI_LEGACY_FALLBACK_ENABLED: env.AI_LEGACY_FALLBACK_ENABLED };
afterEach(() => { jest.restoreAllMocks(); Object.assign(env, providerConfig); });
it.each(['activation', 'model', 'fallback'] as const)('actualiza huella al cambiar proveedor: %s', change => {
  const snapshot = { context: { inputs: pricingInputs(), revision: 1, quoteCount: 0 }, quotes: [], run: null };
  const first = pricingFingerprint(job, snapshot, []);
  if (change === 'activation') env.GROQ_API_KEY = 'test-key-not-a-secret';
  if (change === 'model') env.GROQ_MODEL = 'test-model-v2';
  if (change === 'fallback') env.AI_LEGACY_FALLBACK_ENABLED = !env.AI_LEGACY_FALLBACK_ENABLED;
  expect(pricingFingerprint(job, snapshot, [])).not.toBe(first);
  expect(JSON.stringify(aiProviderCacheConfig())).not.toContain('test-key-not-a-secret');
});
it('no inventa un rango desde categoria, ubicacion o presupuesto deseado', () => {
  expect(calculatePricing(job, null, [], [], 'run')).toMatchObject({ range: null, confidence: 0, status: 'insufficient_data' });
  expect(pricingAgent.estimarPrecio({ categoria: 'electricidad', moneda: 'ARS' })).toMatchObject({ estado: 'informacion_insuficiente', minimo: null, maximo: null, sugerido: null, confianza: 0 });
});
it.each([
  { currency: 'USD' }, { scope: 'Otro alcance distinto' }, { unit: 'm2' as const }, { materials: 'included' as const },
  { taxes: 'unknown' as const }, { quantity: 0 }, { amount: Number.NaN }, { expiresAt: '2000-01-01' }, { date: '2000-01-01' },
])('excluye evidencia incompatible %j', override => {
  expect(comparable(pricingEvidence(0, override), pricingInputs(), Date.now())).toBe(false);
});
it('normaliza cantidades y suma materiales solo si estan excluidos', () => {
  const value = calculatePricing(job, pricingInputs({ quantity: 8, materialsCost: 2000 }), [pricingEvidence()], [pricingQuote()], 'r');
  expect(value.range).toEqual({ min: 22000, max: 22000, central: 22000 }); expect(value.confidence).toBeLessThanOrEqual(40);
});
it('no calcula importes cuando desconoce cobertura', () => {
  expect(calculatePricing(job, pricingInputs({ materials: 'unknown' }), [pricingEvidence()], [], 'r').range).toBeNull();
});
it('excluye extremos con muestra suficiente sin acusar fraude', () => {
  expect(robustValues([100, 100, 100, 100, 9000])).toEqual([100, 100, 100, 100]);
  const rows = [0, 1, 2, 3, 4].map(i => pricingEvidence(i, { amount: i === 4 ? 1000000 : 10000 }));
  const quotes = rows.map((r, i) => pricingQuote(i, { amount: r.amount }));
  const result = calculatePricing(job, pricingInputs(), rows, quotes, 'r');
  expect(result.range?.central).toBe(10000); expect(result.comparisons[4]?.flag).toBe('high');
  expect(result.comparisons[4]?.explanation).toContain('no implica fraude');
});
it('una muestra pequena no permite calificar presupuestos como anomalos', () => {
  const result = calculatePricing(job, pricingInputs(), [pricingEvidence()], [pricingQuote()], 'r');
  expect(result.comparisons[0]?.flag).toBe('unverified');
});
it('valida importes, propiedades extra y cantidad de trabajos completos', () => {
  expect(pricingQuoteSchema.safeParse(pricingQuote(0, { amount: -1 })).success).toBe(false);
  expect(pricingInputsSchema.safeParse({ ...pricingInputs(), companyId: 'other' }).success).toBe(false);
  expect(pricingInputsSchema.safeParse(pricingInputs({ unit: 'job', quantity: 2 })).success).toBe(false);
});
it('Gemini explica sin cambiar rango o confianza ni recibir contactos', async () => {
  env.GEMINI_PRICING_ENABLED = true; jest.spyOn(geminiClient, 'estaDisponible').mockReturnValue(true);
  const spy = jest.spyOn(geminiClient, 'generarEstructurado').mockResolvedValue({ summary: 'El alcance informado permite comparar estas referencias.', evidenceIds: ['e0'], questions: [], cautions: [] });
  const base = calculatePricing(job, pricingInputs(), [pricingEvidence()], [pricingQuote()], 'r');
  const result = await pricingAgent.analyze({ ...job, descripcion: 'Contactar a privado@example.test para revisar el tablero.' }, pricingInputs(), base);
  expect(result.range).toEqual(base.range); expect(result.confidence).toBe(base.confidence); expect(result.semanticUsed).toBe(true);
  expect(spy.mock.calls[0]?.[1]).not.toContain('privado@example.test'); expect(spy.mock.calls[0]?.[1]).not.toContain('quote:');
});
it.each(['timeout', 'invalid_response', 'rate_limit', 'unavailable'] as const)('fallback ante %s', async reason => {
  env.GEMINI_PRICING_ENABLED = true; jest.spyOn(geminiClient, 'estaDisponible').mockReturnValue(true);
  jest.spyOn(geminiClient, 'generarEstructurado').mockRejectedValue(new GeminiIntakeError(reason));
  const base = calculatePricing(job, pricingInputs(), [pricingEvidence()], [], 'r');
  expect(await pricingAgent.analyze(job, pricingInputs(), base)).toMatchObject({ range: base.range, fallbackUsed: true, semanticUsed: false });
});
it.each(['not-json', { summary: 'Precio inventado ARS 500000', evidenceIds: ['e0'], questions: [], cautions: [] },
  { summary: 'Explicacion suficientemente larga', evidenceIds: ['inventado'], questions: [], cautions: [] }])('rechaza salida semantica invalida', async output => {
  env.GEMINI_PRICING_ENABLED = true; jest.spyOn(geminiClient, 'estaDisponible').mockReturnValue(true);
  jest.spyOn(geminiClient, 'generarEstructurado').mockResolvedValue(output);
  const base = calculatePricing(job, pricingInputs(), [pricingEvidence()], [], 'r');
  expect((await pricingAgent.analyze(job, pricingInputs(), base)).fallbackUsed).toBe(true);
});
it('sin evidencia no llama a Gemini', async () => {
  const spy = jest.spyOn(geminiClient, 'generarEstructurado');
  await pricingAgent.analyze(job, null, calculatePricing(job, null, [], [], 'r')); expect(spy).not.toHaveBeenCalled();
});
