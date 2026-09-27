/** @archivo coordinator.test.ts @descripcion Politica de roles, tiempos y consentimiento del agente sin proveedores externos. */
import { coordinatorAdvice, transitionCoordinator } from '../../src/ai/tools/coordinator.tool';
import type { CoordinatorAction, CoordinatorRole, CoordinatorState } from '../../src/models/coordinator.model';
import { COORDINATOR_NOW as now, coordinatorCommand, coordinatorWorkflow } from '../coordinator-fixtures';
import { pricingQuote } from '../pricing-fixtures';

beforeEach(() => jest.useFakeTimers({ now }));
afterEach(() => jest.useRealTimers());

it.each<[CoordinatorState, CoordinatorRole, CoordinatorAction]>([
  ['MATCHED', 'empresa', 'contact'], ['PROFESSIONAL_SELECTED', 'empresa', 'contact'],
  ['CONTACTED', 'profesional', 'respond'], ['PROFESSIONAL_RESPONDED', 'empresa', 'request_quote'],
  ['QUOTE_REQUESTED', 'profesional', 'submit_quote'], ['QUOTE_RECEIVED', 'empresa', 'review_quote'],
])('%s exige %s para %s', (state, role, action) => {
  const w = coordinatorWorkflow({ state });
  expect(coordinatorAdvice(w, role, now).actions).toEqual([action, 'cancel']);
  const other = role === 'empresa' ? 'profesional' : 'empresa';
  expect(coordinatorAdvice(w, other, now).actions).toEqual(['cancel']);
  expect(() => transitionCoordinator(w, other, coordinatorCommand(w, action), now)).toThrow();
});

it('la entrega no equivale a lectura, respuesta ni aprobacion automatica', () => {
  const w = coordinatorWorkflow(); const original = structuredClone(w);
  const next = transitionCoordinator(w, 'empresa', coordinatorCommand(w, 'contact'), now);
  expect(next).toMatchObject({ state: 'CONTACT_PENDING', revision: 2, offer: null, schedule: null });
  for (const role of ['empresa', 'profesional'] as const) {
    expect(coordinatorAdvice(next, role, now).actions).toEqual(['cancel']);
    for (const action of ['respond', 'accept_quote', 'confirm_schedule', 'complete'] as const)
      expect(() => transitionCoordinator(next, role, coordinatorCommand(next, action), now)).toThrow();
  }
  expect(w).toEqual(original);
});

it('rechaza revisiones antiguas y comandos de otro workflow sin mutar', () => {
  const w = coordinatorWorkflow(); const original = structuredClone(w);
  for (const override of [{ revision: 0 }, { workflowId: '00000000-0000-4000-8000-000000000999' }])
    expect(() => transitionCoordinator(w, 'empresa', coordinatorCommand(w, 'contact', override), now))
      .toThrow(expect.objectContaining({ codigoEstado: 409 }));
  expect(w).toEqual(original);
});

it.each(['empresa', 'profesional'] as const)('solo la contraparte acepta una oferta de %s', proposedBy => {
  const w = coordinatorWorkflow({ state: 'NEGOTIATION', offer: { quote: pricingQuote(), proposedBy, accepted: false } });
  const other = proposedBy === 'empresa' ? 'profesional' : 'empresa';
  expect(() => transitionCoordinator(w, proposedBy, coordinatorCommand(w, 'accept_quote'), now)).toThrow();
  const next = transitionCoordinator(w, other, coordinatorCommand(w, 'accept_quote'), now);
  expect(next).toMatchObject({ state: 'SCHEDULE_PENDING', offer: { accepted: true }, schedule: null });
  expect(w.offer?.accepted).toBe(false);
});

it('un presupuesto vencido no se acepta pero permite negociar', () => {
  const w = coordinatorWorkflow({ state: 'COMPANY_REVIEW', offer: {
    quote: pricingQuote(0, { validUntil: '2026-09-22' }), proposedBy: 'profesional', accepted: false,
  } });
  expect(coordinatorAdvice(w, 'empresa', now).actions).toEqual(['counter_offer', 'cancel']);
  expect(() => transitionCoordinator(w, 'empresa', coordinatorCommand(w, 'accept_quote'), now)).toThrow();
  const next = transitionCoordinator(w, 'empresa', coordinatorCommand(w, 'counter_offer', { quote: pricingQuote(1) }), now);
  expect(next).toMatchObject({ state: 'NEGOTIATION', offer: { proposedBy: 'empresa', accepted: false } });
});

it.each([{ validUntil: '2026-09-22' }, { validUntil: '2028-01-01' },
  { materials: 'unknown' as const }, { taxes: 'unknown' as const }])('rechaza vigencia o cobertura invalida %j', override => {
  const w = coordinatorWorkflow({ state: 'QUOTE_REQUESTED' });
  expect(() => transitionCoordinator(w, 'profesional', coordinatorCommand(w, 'submit_quote', { quote: pricingQuote(0, override) }), now))
    .toThrow(expect.objectContaining({ codigoEstado: 400 }));
});

it.each(['empresa', 'profesional'] as const)('horario propuesto por %s necesita confirmacion bilateral futura', role => {
  const w = coordinatorWorkflow({ state: 'SCHEDULE_PENDING' });
  const next = transitionCoordinator(w, role, coordinatorCommand(w, 'propose_schedule', {
    schedule: { startsAt: '2026-09-24T09:00:00-03:00', endsAt: '2026-09-24T11:00:00-03:00' },
  }), now);
  expect(next.schedule).toEqual({ startsAt: '2026-09-24T12:00:00.000Z', endsAt: '2026-09-24T14:00:00.000Z', proposedBy: role, confirmed: false });
  const other = role === 'empresa' ? 'profesional' : 'empresa';
  expect(() => transitionCoordinator(next, role, coordinatorCommand(next, 'confirm_schedule'), now)).toThrow();
  expect(() => transitionCoordinator(next, other, coordinatorCommand(next, 'confirm_schedule'), now + 86400000)).toThrow();
  expect(transitionCoordinator(next, other, coordinatorCommand(next, 'confirm_schedule'), now))
    .toMatchObject({ state: 'CONFIRMED', schedule: { confirmed: true } });
});

it.each([[0, 3600000], [-1, 3600000], [3600000, 3600000], [7200000, 3600000],
  [367 * 86400000, 368 * 86400000], [86400000, 92 * 86400000]])('rechaza horario no futuro o limites %j %j', (start, end) => {
  const w = coordinatorWorkflow({ state: 'SCHEDULE_PENDING' });
  expect(() => transitionCoordinator(w, 'empresa', coordinatorCommand(w, 'propose_schedule', {
    schedule: { startsAt: new Date(now + start).toISOString(), endsAt: new Date(now + end).toISOString() },
  }), now)).toThrow(expect.objectContaining({ codigoEstado: 400 }));
});

it('no permite empezar antes ni cerrar sin solicitud del profesional y confirmacion de empresa', () => {
  const w = coordinatorWorkflow({ state: 'CONFIRMED', schedule: {
    startsAt: new Date(now + 1000).toISOString(), endsAt: new Date(now + 3600000).toISOString(), proposedBy: 'empresa', confirmed: true,
  } });
  expect(() => transitionCoordinator(w, 'profesional', coordinatorCommand(w, 'start_work'), now)).toThrow();
  expect(() => transitionCoordinator(w, 'empresa', coordinatorCommand(w, 'start_work'), now + 1000)).toThrow();
  const started = transitionCoordinator(w, 'profesional', coordinatorCommand(w, 'start_work'), now + 1000);
  expect(() => transitionCoordinator(started, 'empresa', coordinatorCommand(started, 'complete'), now + 1000)).toThrow();
  expect(() => transitionCoordinator(started, 'empresa', coordinatorCommand(started, 'request_completion'), now + 1000)).toThrow();
  expect(coordinatorAdvice(started, 'profesional', now).actions).toEqual(['request_completion']);
  const requested = transitionCoordinator(started, 'profesional', coordinatorCommand(started, 'request_completion'), now + 1000);
  expect(requested).toMatchObject({ state: 'IN_PROGRESS', completionRequested: true });
  expect(() => transitionCoordinator(requested, 'profesional', coordinatorCommand(requested, 'complete'), now + 1000)).toThrow();
  expect(transitionCoordinator(requested, 'empresa', coordinatorCommand(requested, 'complete'), now + 1000).state).toBe('COMPLETED');
});

it.each(['COMPLETED', 'CANCELLED'] as const)('%s es terminal para ambos roles', state => {
  const w = coordinatorWorkflow({ state });
  for (const role of ['empresa', 'profesional'] as const) {
    expect(coordinatorAdvice(w, role, now)).toMatchObject({ actions: [], waitingFor: null });
    expect(() => transitionCoordinator(w, role, coordinatorCommand(w, 'cancel', { note: 'Cancelacion de prueba' }), now)).toThrow();
  }
});
