/** @archivo business-ai.test.ts @descripcion Cuotas, evidencia, costos y privacidad con proveedor simulado. */
import { env } from '../../src/config/env';
import { businessAi } from '../../src/ai/tools/business-ai.tool';
import { geminiClient, GeminiIntakeError } from '../../src/integrations/gemini/gemini.client';
import { governanceRepository } from '../../src/repositories/governance.repository';
import { recordProviderUsage } from '../../src/monitoring/ai-usage';
import { ApiError } from '../../src/middleware/error.middleware';
import { marketingAgent } from '../../src/ai/agents/marketing.agent';
import { toolAllowed } from '../../src/constants/agent-policy';
import { z } from 'zod';
jest.mock('../../src/repositories/governance.repository', () => ({ governanceRepository: { reserve: jest.fn(), record: jest.fn() } }));
const previous = { ...env };
const options = { actor: { uid: 'company-a', rol: 'empresa' as const }, agent: 'sales' as const,
  promptVersion: 'test', system: 'Instrucciones', data: { need: 'publicar trabajos' },
  schema: z.object({ intent: z.enum(['exploring','purchase']) }).strict(), jsonSchema: { type: 'object' },
  fallback: { intent: 'exploring' as const } };
beforeEach(() => {
  env.AI_BUSINESS_LLM_ENABLED = true; env.AI_COST_RATES_JSON = {};
  jest.spyOn(geminiClient, 'estaDisponible').mockReturnValue(true);
  jest.spyOn(geminiClient, 'generarEstructurado').mockResolvedValue({ intent: 'purchase' });
  jest.mocked(governanceRepository.reserve).mockResolvedValue();
  jest.mocked(governanceRepository.record).mockResolvedValue({} as never);
});
afterEach(() => { Object.assign(env, previous); jest.restoreAllMocks(); jest.resetAllMocks(); });
it('mantiene reglas sin consumir cuota cuando el proveedor esta deshabilitado', async () => {
  env.AI_BUSINESS_LLM_ENABLED = false;
  await expect(businessAi(options)).resolves.toEqual({ value: options.fallback, usedAi: false });
  expect(governanceRepository.reserve).not.toHaveBeenCalled();
  expect(geminiClient.generarEstructurado).not.toHaveBeenCalled();
});
it('no llama al proveedor cuando se agota la cuota diaria', async () => {
  jest.mocked(governanceRepository.reserve).mockRejectedValue(new ApiError('limite',429));
  expect((await businessAi(options)).usedAi).toBe(false);
  expect(geminiClient.generarEstructurado).not.toHaveBeenCalled();
  expect(governanceRepository.record).toHaveBeenCalledWith(expect.objectContaining({ fallbackReason: 'budget_exhausted' }));
});
it('calcula costos solo con tokens observados y tarifas configuradas', async () => {
  env.AI_COST_RATES_JSON = { groq: { inputUsdPerMillion: 1, outputUsdPerMillion: 2 } };
  jest.mocked(geminiClient.generarEstructurado).mockImplementation(async () => {
    recordProviderUsage('groq', 'test-model', 100, 50, 20); return { intent: 'purchase' };
  });
  expect((await businessAi(options)).usedAi).toBe(true);
  expect(governanceRepository.record).toHaveBeenCalledWith(expect.objectContaining({
    estimatedCostUsd: 0.0002, costBasis: 'configured_rates' }));
  expect(JSON.stringify(jest.mocked(governanceRepository.record).mock.calls)).not.toContain('publicar trabajos');
});
it('no inventa un costo cero si faltan tarifas', async () => {
  jest.mocked(geminiClient.generarEstructurado).mockImplementation(async () => {
    recordProviderUsage('groq', 'test-model', 100, 50, 20); return { intent: 'purchase' };
  });
  await businessAi(options);
  expect(governanceRepository.record).toHaveBeenCalledWith(expect.objectContaining({ estimatedCostUsd: null, costBasis: 'unavailable' }));
});
it('rechaza salida fuera del schema y conserva el fallback', async () => {
  jest.mocked(geminiClient.generarEstructurado).mockImplementation(async (_system, _prompt, _schema, validation) => {
    expect(validation?.validate?.({ intent: 'admin', arbitraryTool: 'delete' })).toBe(false);
    throw new GeminiIntakeError('invalid_response');
  });
  expect((await businessAi(options)).usedAi).toBe(false);
  expect(governanceRepository.record).toHaveBeenCalledWith(expect.objectContaining({ validationFailures: 1, fallbackReason: 'invalid_response' }));
});
it('aplica restricciones de evidencia adicionales al schema', async () => {
  jest.mocked(geminiClient.generarEstructurado).mockImplementation(async (_s, _p, _j, validation) => {
    expect(validation?.validate?.({ intent: 'purchase' })).toBe(false);
    throw new GeminiIntakeError('invalid_response');
  });
  expect((await businessAi({ ...options, validate: () => false })).usedAi).toBe(false);
});
it('un fallo de telemetria no descarta una respuesta valida', async () => {
  jest.mocked(governanceRepository.record).mockRejectedValue(new Error('storage offline'));
  expect((await businessAi(options)).usedAi).toBe(true);
});
it('deniega herramientas desconocidas, cambios de permisos y uso por rol incorrecto', () => {
  expect(toolAllowed('support', 'deleteCollection', 'admin')).toBe(false);
  expect(toolAllowed('unknown', 'getJob', 'empresa')).toBe(false);
  expect(toolAllowed('sales', 'qualifyLead', 'empresa')).toBe(false);
  expect(toolAllowed('matching', 'executeMatching', 'profesional')).toBe(false);
  expect(toolAllowed('support', 'getJob', 'empresa')).toBe(true);
});
it('Marketing devuelve metricas desconocidas sin denominadores y no inventa ROI/LTV', () => {
  const metrics = marketingAgent.metrics({ impressions: 0, clicks: 0, conversions: 0, acquiredCustomers: 0,
    spendMinor: 0, attributedRevenueMinor: 0, activeAtStart: 0, retained: 0, churned: 0 });
  expect(Object.values(metrics).every(value => value === null)).toBe(true);
  expect(marketingAgent.metrics({ impressions: 100, clicks: 20, conversions: 4, acquiredCustomers: 2,
    spendMinor: 1000, attributedRevenueMinor: 4000, activeAtStart: 10, retained: 8, churned: 2 }))
    .toEqual({ ctr: 0.2, conversion: 0.2, cacMinor: 500, retention: 0.8, churn: 0.2, roas: 4, roi: null, ltv: null });
});
