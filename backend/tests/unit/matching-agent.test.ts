/**
 * @archivo matching-agent.test.ts
 * @descripcion JSON validado y fallback semantico sin usar credenciales reales.
 */
import { matchingAgent } from '../../src/ai/agents/matching.agent';
import { geminiClient, GeminiIntakeError } from '../../src/integrations/gemini/gemini.client';
import { rankingTool } from '../../src/ai/tools/ranking.tool';
import { env } from '../../src/config/env';
import { matchingJob, matchingProfessional } from '../matching-fixtures';
const job = matchingJob();
const candidates = rankingTool.rankearProfesionales(job, [matchingProfessional()]);
const row = { professionalId: 'pro-electrician', semanticScore: 91, reason: 'Experiencia declarada en tableros.',
  strengths: ['Habilidad relevante'], concerns: [], recommended: true };
beforeEach(() => { jest.spyOn(geminiClient, 'estaDisponible').mockReturnValue(true); env.GEMINI_MATCHING_ENABLED = true; });
afterEach(() => jest.restoreAllMocks());
it('usa el cliente existente, esquema JSON y modelo configurado', async () => {
  const generation = jest.spyOn(geminiClient, 'generarEstructurado').mockResolvedValue({ matches: [row] });
  expect(await matchingAgent.analyze(job, candidates)).toMatchObject({ used: true, fallback: false, matches: [row] });
  expect(generation.mock.calls[0][3]).toEqual({ model: env.GEMINI_MATCHING_MODEL, timeoutMs: 30000 });
});
it.each(['JSON invalido', { matches: [{ ...row, semanticScore: 200 }] }, { matches: [{ ...row, professionalId: 'inventado' }] }, { matches: [row, row] }, { matches: [] }])('rechaza respuesta invalida o candidatos inventados', async value => {
  jest.spyOn(geminiClient, 'generarEstructurado').mockResolvedValue(value);
  expect(await matchingAgent.analyze(job, candidates)).toEqual({ used: false, fallback: true, matches: [] });
});
it.each(['timeout', 'rate_limit', 'unavailable', 'invalid_response'] as const)('conserva fallback ante %s', async reason => {
  jest.spyOn(geminiClient, 'generarEstructurado').mockRejectedValue(new GeminiIntakeError(reason));
  expect((await matchingAgent.analyze(job, candidates)).fallback).toBe(true);
});
it('no llama a Gemini sin candidatos o cuando esta deshabilitado', async () => {
  const generation = jest.spyOn(geminiClient, 'generarEstructurado');
  expect(await matchingAgent.analyze(job, [])).toEqual({ used: false, fallback: false, matches: [] });
  env.GEMINI_MATCHING_ENABLED = false;
  expect((await matchingAgent.analyze(job, candidates)).fallback).toBe(true);
  expect(generation).not.toHaveBeenCalled();
});
