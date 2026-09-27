/** @archivo coordinatorForms.ts @descripcion Validacion de presupuestos y agenda antes del consentimiento. */
import type { PricingQuote } from '../../../shared/pricing';
import type { CoordinatorCommand } from '../../../shared/coordinator';

/** Campos editables; numeros como texto para preservar entradas incompletas. */
export interface CoordinatorQuoteDraft extends Omit<PricingQuote, 'amount' | 'quantity'> { amount: string; quantity: string }

/** Crea campos desde la oferta vigente sin asumir importe ni fecha de validez. */
export function quoteDraft(id: string, quote?: PricingQuote, currency = 'ARS', scope = ''): CoordinatorQuoteDraft {
  return { id, label: quote?.label ?? '', amount: quote ? String(quote.amount) : '',
    currency: quote?.currency ?? currency, scope: quote?.scope ?? scope, unit: quote?.unit ?? 'job',
    quantity: String(quote?.quantity ?? 1), materials: quote?.materials ?? 'unknown', taxes: quote?.taxes ?? 'unknown',
    validUntil: quote?.validUntil ?? '' };
}

/** Rechaza fechas normalizadas silenciosamente, por ejemplo 30 de febrero. */
function validDay(value: string): boolean {
  const date = new Date(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Produce todos los campos de PricingQuote y aplica los limites del contrato HTTP. */
export function parseCoordinatorQuote(draft: CoordinatorQuoteDraft): PricingQuote {
  const amount = Number(draft.amount.replace(',', '.'));
  const quantity = Number(draft.quantity.replace(',', '.'));
  const label = draft.label.trim(); const scope = draft.scope.trim(); const currency = draft.currency.trim().toUpperCase();
  if (label.length < 2 || label.length > 100) throw new Error('La referencia debe tener entre 2 y 100 caracteres.');
  if (scope.length < 8 || scope.length > 400) throw new Error('El alcance debe tener entre 8 y 400 caracteres.');
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Indica una moneda de tres letras.');
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000) throw new Error('Indica un importe positivo de hasta 1.000.000.000.');
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000 || (draft.unit === 'job' && quantity !== 1))
    throw new Error('Indica una cantidad positiva de hasta 100.000; para trabajo completo debe ser 1.');
  if (!validDay(draft.validUntil)) throw new Error('Indica una fecha de validez real en formato AAAA-MM-DD.');
  return { ...draft, label, scope, currency, amount, quantity };
}

/** Exige ISO completo con zona explicita y conserva el instante al normalizar a UTC. */
export function parseCoordinatorInstant(value: string): string {
  const text = value.trim();
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/.exec(text);
  if (!match || !validDay(match[1]) || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59
    || (match[5] !== 'Z' && (Number(match[6]) > 23 || Number(match[7]) > 59)) || Number.isNaN(Date.parse(text)))
    throw new Error('Indica fechas ISO con zona: AAAA-MM-DDTHH:mm:ss-03:00 o Z.');
  return new Date(text).toISOString();
}

/** Valida orden y futuro de la propuesta; el servidor vuelve a validar al confirmar. */
export function parseCoordinatorSchedule(startsAt: string, endsAt: string): NonNullable<CoordinatorCommand['schedule']> {
  const start = parseCoordinatorInstant(startsAt); const end = parseCoordinatorInstant(endsAt);
  if (Date.parse(start) <= Date.now()) throw new Error('El inicio de la agenda debe ser futuro.');
  if (Date.parse(end) <= Date.parse(start)) throw new Error('El fin debe ser posterior al inicio.');
  return { startsAt: start, endsAt: end };
}

/** Omite notas vacias y exige motivo para cancelar. */
export function coordinatorNote(value: string, required: boolean): string | undefined {
  const note = value.trim();
  if ((required || note) && (note.length < 3 || note.length > 500)) throw new Error('La nota debe tener entre 3 y 500 caracteres.');
  return note || undefined;
}
