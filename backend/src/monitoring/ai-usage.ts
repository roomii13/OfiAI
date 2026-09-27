/** @archivo ai-usage.ts @descripcion Telemetria aislada por ejecucion, sin prompts ni respuestas. */
import { AsyncLocalStorage } from 'node:async_hooks';
export interface ProviderUsage {
  provider: 'groq' | 'deepseek' | 'gemini'; model: string; inputTokens: number | null; outputTokens: number | null;
  latencyMs: number; error: string | null;
}
export const aiUsageContext=new AsyncLocalStorage<ProviderUsage[]>();
/** Solo acepta contadores reportados por el proveedor, nunca estimaciones como consumo real. */
export function recordProviderUsage(provider: ProviderUsage['provider'],model: string,input: unknown,output: unknown,latencyMs: number,error: string | null = null): void {
  const tokens=(value: unknown): number | null => typeof value==='number' && Number.isInteger(value) && value>=0 ? value : null;
  aiUsageContext.getStore()?.push({provider,model,inputTokens: tokens(input),outputTokens: tokens(output),latencyMs,error});
}
