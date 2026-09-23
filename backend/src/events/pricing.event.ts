/** @archivo pricing.event.ts @descripcion Eventos preparados para analytics y Coordinator, sin datos personales. */
import type { PricingEstimate } from '../models/pricing.model';
export type PricingEventType = 'pricing_started' | 'pricing_completed' | 'pricing_failed' | 'pricing_fallback_used' | 'pricing_inputs_updated' | 'pricing_quote_recorded';
/** Solo emite metadatos operativos, nunca textos, precios privados ni prompts. */
export function pricingEvent(type: PricingEventType, jobId: string, result?: PricingEstimate, duration = 0) {
  return { tipo: type, entidadId: jobId, entidadTipo: 'pricing', fechaCreacion: new Date(),
    metadata: { estimateId: result?.id ?? null, evidenceCount: result?.evidenceCount ?? 0,
      confidence: result?.confidence ?? 0, semanticUsed: result?.semanticUsed ?? false,
      fallbackUsed: result?.fallbackUsed ?? false, insufficient: result?.status === 'insufficient_data', duration } };
}
