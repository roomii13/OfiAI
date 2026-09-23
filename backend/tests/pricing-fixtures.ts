/** @archivo pricing-fixtures.ts @descripcion Precios sinteticos solo para tests, nunca catalogo real. */
import type { PricingInputs, PricingQuote, PricingEvidence } from '../src/models/pricing.model';
/** Alcance acotado con cobertura explicita. */
export function pricingInputs(overrides: Partial<PricingInputs> = {}): PricingInputs {
  return { scope: 'Revision de tablero electrico', currency: 'ARS', unit: 'hour', quantity: 4,
    materials: 'excluded', taxes: 'excluded', materialsCost: null, requiredExperienceYears: 2, ...overrides };
}
/** Presupuesto declarado por la empresa de prueba. */
export function pricingQuote(index = 0, overrides: Partial<PricingQuote> = {}): PricingQuote {
  return { id: '00000000-0000-4000-8000-' + String(index).padStart(12, '0'), label: 'Presupuesto de prueba ' + index,
    scope: pricingInputs().scope, currency: 'ARS', unit: 'hour', quantity: 4, materials: 'excluded', taxes: 'excluded',
    amount: 10000 + index * 1000, validUntil: new Date(Date.now() + 86400000 * 10).toISOString().slice(0, 10), ...overrides };
}
/** Referencia con origen y vigencia. */
export function pricingEvidence(index = 0, overrides: Partial<PricingEvidence> = {}): PricingEvidence {
  const quote = pricingQuote(index);
  return { id: 'quote:' + quote.id, source: 'quote', amount: quote.amount, currency: quote.currency, scope: quote.scope,
    unit: quote.unit, quantity: quote.quantity, materials: quote.materials, taxes: quote.taxes,
    date: new Date().toISOString(), expiresAt: quote.validUntil + 'T23:59:59.999Z', ...overrides };
}
