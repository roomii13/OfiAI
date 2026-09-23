/** @archivo pricing.tool.ts @descripcion Estadistica trazable; nunca usa el presupuesto deseado como precio de mercado. */
import { PRICING_POLICY as P } from '../../constants/pricing';
import { normalizeMatchText, publicMatchingJob } from '../../domain/matching/matching';
import type { Trabajo } from '../../models/Job';
import type { PricingInputs, PricingEvidence, PricingQuote, PricingEstimate, QuoteComparison } from '../../models/pricing.model';
/** Interpolacion determinista sobre una muestra ordenada. */
export function quantile(values: number[], fraction: number): number {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const index = (ordered.length - 1) * fraction; const low = Math.floor(index);
  return ordered[low]! + (ordered[Math.ceil(index)]! - ordered[low]!) * (index - low);
}
/** Redondea importes, no probabilidades ni conversiones monetarias. */
function money(value: number): number { return Math.round(value * 100) / 100; }
/** Descarta diferencias de alcance, unidad, moneda y cobertura antes de calcular. */
export function comparable(e: PricingEvidence, input: PricingInputs, now: number): boolean {
  return Number.isFinite(e.amount) && e.amount > 0 && e.amount <= 1e9 && e.quantity > 0 && Number.isFinite(e.quantity)
    && e.currency === input.currency && e.unit === input.unit
    && normalizeMatchText(e.scope) === normalizeMatchText(input.scope)
    && input.materials !== 'unknown' && input.taxes !== 'unknown'
    && e.materials === input.materials && e.taxes === input.taxes
    && Number.isFinite(Date.parse(e.date)) && Date.parse(e.date) <= now
    && now - Date.parse(e.date) <= P.historyAgeDays * 86400000
    && (e.expiresAt === null || Date.parse(e.expiresAt) >= now);
}
/** Marca atipicos solo con muestra suficiente; un desvio no prueba fraude. */
export function robustValues(values: number[]): number[] {
  if (values.length < P.outlierMinSamples) return values;
  const q1 = quantile(values, .25); const q3 = quantile(values, .75);
  const spread = q3 - q1;
  return values.filter(value => spread === 0 ? value === q1 : value >= q1 - P.iqrMultiplier * spread && value <= q3 + P.iqrMultiplier * spread);
}
/** Conserva cada presupuesto, incluso cuando no resulta comparable. */
function compareQuotes(quotes: PricingQuote[], evidence: PricingEvidence[], input: PricingInputs | null, now: number): QuoteComparison[] {
  return quotes.map(quote => {
    const row = evidence.find(e => e.id === 'quote:' + quote.id || e.id === quote.id);
    const eligible = Boolean(input && row && comparable(row, input, now));
    const amount = eligible && input && row ? row.amount / row.quantity * input.quantity : null;
    const peers = input ? evidence.filter(e => e.id !== row?.id && e.source === 'quote' && comparable(e, input, now)).map(e => e.amount / e.quantity * input.quantity) : [];
    const reference = peers.length >= P.comparisonMinPeers ? quantile(robustValues(peers), .5) : 0;
    const ratio = amount !== null && reference > 0 ? amount / reference : null;
    const flag = ratio === null ? 'unverified' : ratio < P.lowRatio ? 'low' : ratio > P.highRatio ? 'high' : 'normal';
    return { id: quote.id, label: quote.label, amount: quote.amount, currency: quote.currency,
      comparable: eligible, normalizedAmount: amount === null ? null : money(amount),
      deviationPercent: ratio === null ? null : money((ratio - 1) * 100), flag,
      explanation: !eligible ? 'No comparable: revisa moneda, alcance, unidad, cobertura o vigencia.'
        : ratio === null ? 'Sin suficientes presupuestos independientes para evaluar desvios.'
        : flag === 'normal' ? 'Dentro del umbral de comparacion; no garantiza calidad ni precio final.'
        : 'Importe atipico frente a los otros presupuestos. Confirma alcance y condiciones; no implica fraude.' };
  });
}
/** Genera rangos observados, confianza heuristica y datos faltantes sin inventar precios. */
export function calculatePricing(job: Trabajo, input: PricingInputs | null, evidence: PricingEvidence[], quotes: PricingQuote[], id: string, now = Date.now()): PricingEstimate {
  const jobView = publicMatchingJob(job);
  const missing: string[] = [];
  const warnings = ['Estimacion orientativa, no cotizacion ni contratacion. La confianza mide suficiencia de evidencia, no precision estadistica.'];
  const factors = ['Categoria: ' + jobView.category, 'Ubicacion: ' + (jobView.location.city ?? 'Por confirmar'),
    'Urgencia: ' + (jobView.urgency ?? 'Por confirmar') + '. No se aplican recargos sin evidencia.',
    'Alcance del Job: ' + (jobView.estimatedScope ?? jobView.description)];
  if (!input) missing.push('Confirma alcance, unidad, cantidad, moneda y cobertura de costos.');
  if (input?.materials === 'unknown') missing.push('Confirma si los importes incluyen materiales.');
  if (input?.taxes === 'unknown') missing.push('Confirma si los importes incluyen impuestos.');
  if (input?.materials === 'excluded' && input.materialsCost === null) warnings.push('Materiales fuera del rango. Su costo aun no esta informado.');
  if (input?.taxes === 'excluded') warnings.push('Impuestos excluidos. No se calculan impuestos automaticamente.');
  if (input) factors.push('Alcance confirmado: ' + input.scope + ' (' + input.quantity + ' ' + input.unit + ')',
    input.requiredExperienceYears === null ? 'Experiencia requerida: por confirmar.' : 'Experiencia minima requerida: ' + input.requiredExperienceYears + ' anos. No se aplica un recargo arbitrario.');
  const valid = input ? evidence.filter(e => comparable(e, input, now)) : [];
  const basis = (['quote', 'history', 'rate'] as const).find(source => valid.some(e => e.source === source)) ?? null;
  const selected = valid.filter(e => e.source === basis);
  const amounts = input ? selected.map(e => e.amount / e.quantity * input.quantity) : [];
  const scaled = Boolean(input && selected.some(e => e.quantity !== input.quantity));
  const robust = robustValues(amounts);
  if (robust.length < amounts.length) warnings.push('Valores extremos excluidos del rango mediante IQR; siguen visibles en la comparacion.');
  if (!robust.length) missing.push('Faltan presupuestos comparables, historicos propios o tarifas horarias aplicables.');
  if (basis === 'rate') warnings.push('Tarifas horarias publicadas por candidatos: no son una oferta para este trabajo. Horas declaradas por la empresa.');
  if (basis === 'history') warnings.push('Historicos de presupuestos aceptados en trabajos completados: no acreditan pagos ni costos finales. Sin ajuste por inflacion.');
  if (basis === 'quote') warnings.push('Presupuestos registrados por la empresa; OfiAI no verifico al emisor.');
  if (robust.length === 1) warnings.push('Una sola referencia: el rango coincide con ese importe y no mide dispersion del mercado.');
  const materials = input?.materials === 'excluded' ? input.materialsCost ?? 0 : 0;
  const range = robust.length ? { min: money(quantile(robust, .1) + materials), max: money(quantile(robust, .9) + materials), central: money(quantile(robust, .5) + materials) } : null;
  if (range && range.max > 1e12) throw new Error('pricing_amount_overflow');
  let confidence = basis ? Math.min(P.confidence.max, P.confidence[basis] + Math.min(robust.length - 1, 4) * 5) : 0;
  if (scaled) { confidence = Math.max(0, confidence - 10); warnings.push('Normalizacion proporcional por unidad: confirma descuentos por volumen y costos fijos.'); }
  if (robust.length === 1) confidence = Math.min(confidence, 40);
  if (input?.materials === 'excluded' && input.materialsCost === null) confidence = Math.max(0, confidence - 10);
  if (jobView.urgency === 'high' || jobView.urgency === 'emergency') {
    confidence = Math.max(0, confidence - 10); warnings.push('La urgencia requiere confirmar disponibilidad y recargos con el profesional.');
  }
  const received = evidence.filter(e => e.source === 'quote' && e.id.startsWith('proposal:')).map<PricingQuote>(e => ({
    id: e.id, label: 'Presupuesto recibido ' + e.id.slice(9, 17), scope: e.scope, unit: e.unit, quantity: e.quantity,
    materials: e.materials, taxes: e.taxes, currency: e.currency, amount: e.amount, validUntil: e.expiresAt?.slice(0, 10) ?? '',
  }));
  return { id, version: P.version, generatedAt: new Date(now).toISOString(), expiresAt: new Date(now + P.ttlMs).toISOString(),
    status: range ? 'estimated' : 'insufficient_data', currency: input?.currency ?? job.moneda,
    range, basis, confidence, confidenceLevel: confidence >= 75 ? 'high' : confidence >= 50 ? 'medium' : 'low',
    missingInformation: missing, factors, warnings, evidenceCount: selected.length,
    comparisons: compareQuotes([...quotes, ...received], evidence, input, now), semanticUsed: false, fallbackUsed: false,
    analysis: null, assumptions: ['Sin conversion de moneda.', 'Sin recargos automaticos por zona, categoria, materiales o experiencia.',
      'La experiencia del emisor de un presupuesto declarado requiere verificacion.'],
    evidence: selected };
}
