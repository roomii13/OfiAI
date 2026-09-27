/** @archivo coordinatorForms.test.ts @descripcion Contratos nativos de terminos y fechas de coordinacion. */
import { coordinatorNote, parseCoordinatorInstant, parseCoordinatorQuote, parseCoordinatorSchedule, quoteDraft } from './coordinatorForms';

/** Fecha futura estable respecto del reloj de prueba. */
function futureDay(days = 7): string { return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10); }

it('conserva el presupuesto incompleto sin inventar importe ni vencimiento', () => {
  const draft = quoteDraft('', undefined, 'ARS', 'Reparacion del tablero');
  expect(draft.amount).toBe('');
  expect(draft.validUntil).toBe('');
  expect(() => parseCoordinatorQuote(draft)).toThrow();
});

it('envia terminos completos y rechaza importes o dias invalidos', () => {
  const draft = { ...quoteDraft('', undefined, 'ARS', 'Reparacion del tablero'),
    label: 'Presupuesto completo', amount: '24000,50', quantity: '1', materials: 'included' as const,
    taxes: 'excluded' as const, validUntil: futureDay() };
  expect(parseCoordinatorQuote(draft)).toMatchObject({ amount: 24000.5, currency: 'ARS', quantity: 1 });
  expect(() => parseCoordinatorQuote({ ...draft, amount: '-1' })).toThrow();
  expect(() => parseCoordinatorQuote({ ...draft, validUntil: '2026-02-30' })).toThrow();
});

it('requiere zona horaria explicita y agenda futura ordenada', () => {
  const start = new Date(Date.now() + 86400000).toISOString();
  const end = new Date(Date.now() + 90000000).toISOString();
  expect(parseCoordinatorSchedule(start, end)).toEqual({ startsAt: start, endsAt: end });
  expect(parseCoordinatorInstant('2026-10-01T10:00:00-03:00')).toBe('2026-10-01T13:00:00.000Z');
  expect(() => parseCoordinatorInstant('2026-10-01T10:00:00')).toThrow();
  expect(() => parseCoordinatorSchedule(end, start)).toThrow();
});

it('exige motivo al cancelar y omite notas vacias opcionales', () => {
  expect(coordinatorNote(' ', false)).toBeUndefined();
  expect(() => coordinatorNote(' ', true)).toThrow();
  expect(coordinatorNote('Trabajo pospuesto', true)).toBe('Trabajo pospuesto');
});
