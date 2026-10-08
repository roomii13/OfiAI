/** @archivo business-ai.tool.ts @descripcion IA opcional con JSON validado, cuotas y fallback verificable. */
import type { ZodType } from 'zod';
import { geminiClient, GeminiIntakeError } from '../../integrations/gemini/gemini.client';
import { env } from '../../config/env';
import { aiUsageContext, type ProviderUsage } from '../../monitoring/ai-usage';
import { governanceRepository } from '../../repositories/governance.repository';
import { logger } from '../../config/logger';
import type { AgentActor } from '../../models/agent.model';
import { redactSecrets } from '../../validators/support.validator';
import { ApiError } from '../../middleware/error.middleware';
/** El modelo propone datos; la funcion validate aplica restricciones adicionales de dominio. */
export async function businessAi<T>(options: {
  actor: AgentActor; agent: 'sales' | 'marketing' | 'support' | 'analytics' | 'disputes'; promptVersion: string;
  system: string; data: unknown; schema: ZodType<T>; jsonSchema: Record<string,unknown>;
  fallback: T; validate?: (value: T)=>boolean;
}): Promise<{value: T; usedAi: boolean}> {
  const started=Date.now(); const usage: ProviderUsage[]=[];
  let result=options.fallback; let status: 'completed' | 'fallback'='fallback'; let reason: string | null='disabled';
  let validationFailures=0;
  const outcome={usedAi: false};
  await aiUsageContext.run(usage,async()=>{
    if(!env.AI_BUSINESS_LLM_ENABLED || !geminiClient.estaDisponible()) return;
    try {
      await governanceRepository.reserve(options.actor.uid);
      const raw=await geminiClient.generarEstructurado(options.system,redactSecrets(JSON.stringify(options.data)).slice(0,18000),
        options.jsonSchema,{timeoutMs: 12000,validate: value=>{
          const parsed=options.schema.safeParse(value);
          const valid=parsed.success && (!options.validate || options.validate(parsed.data));
          if(!valid) validationFailures++; return valid;
        }});
      result=options.schema.parse(raw); status='completed'; reason=null; outcome.usedAi=true;
    } catch(error) { reason=error instanceof GeminiIntakeError ? error.reason : error instanceof ApiError ? 'budget_exhausted' : 'unavailable'; }
  });
  let estimatedCostUsd: number | null=usage.length ? 0 : null;
  for(const row of usage) {
    const rate=env.AI_COST_RATES_JSON[row.provider];
    if(!rate || row.inputTokens===null || row.outputTokens===null) {estimatedCostUsd=null;break;}
    estimatedCostUsd!+=(row.inputTokens*rate.inputUsdPerMillion+row.outputTokens*rate.outputUsdPerMillion)/1000000;
  }
  try { await governanceRepository.record({ownerId: options.actor.uid,agent: options.agent,status,
    startedAt: new Date(started).toISOString(),durationMs: Date.now()-started,providerCalls: usage,
    estimatedCostUsd,costBasis: estimatedCostUsd===null?'unavailable':'configured_rates',
    validationFailures,fallbackReason: reason,promptVersion: options.promptVersion}); }
  catch {logger.warn('No se pudo persistir telemetria IA.',{agent: options.agent});}
  return {value: result,usedAi: outcome.usedAi};
}
