/** @archivo coordinator.ts @descripcion Comandos bilaterales con revision e idempotencia. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from './client';
import { useAuth } from '../../context/AuthContext';
import type { ApiResult } from '../../../../shared/contracts';
import type { CoordinatorAction, CoordinatorCommand, CoordinatorStart, CoordinatorView } from '../../../../shared/coordinator';

export type CoordinatorInput = Omit<CoordinatorCommand, 'workflowId' | 'revision' | 'idempotencyKey'>;
type Attempt = { path: string; body: CoordinatorStart | CoordinatorCommand };

/** Un rechazo profesional permite reiniciar solo mientras el trabajo siga publicado. */
export function canStart(view: CoordinatorView): boolean {
  return view.role === 'empresa' && view.job.status === 'publicado'
    && (!view.workflow || view.workflow.state === 'CANCELLED');
}

/** Restringe las acciones sugeridas sin inventar transiciones del servidor. */
export function canCommand(view: CoordinatorView, action: CoordinatorAction, now = Date.now()): boolean {
  const workflow = view.workflow;
  if (!workflow || !view.advice.actions.includes(action)) return false;
  if (action === 'cancel') return !['IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(workflow.state);
  if (action === 'start_work') return view.role === 'profesional' && workflow.state === 'CONFIRMED'
    && workflow.schedule?.confirmed === true && Date.parse(workflow.schedule.startsAt) <= now;
  if (action === 'complete') return view.role === 'empresa' && workflow.state === 'IN_PROGRESS' && workflow.completionRequested;
  if (action === 'accept_quote') return Boolean(workflow.offer && !workflow.offer.accepted && workflow.offer.proposedBy !== view.role);
  if (action === 'confirm_schedule') return Boolean(workflow.schedule && !workflow.schedule.confirmed && workflow.schedule.proposedBy !== view.role);
  return true;
}

/** Solo GET al montar. Reintentar conserva exactamente cuerpo, UUID y revision. */
export function useCoordinator(jobId: string) {
  const { user, role } = useAuth();
  const userId = user?.id;
  const key = (userId ?? '') + ':' + role + ':' + jobId;
  const [stateKey, setStateKey] = useState(key);
  const [view, setView] = useState<CoordinatorView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [failedAttempt, setFailedAttempt] = useState<Attempt | null>(null);
  const latest = useRef<CoordinatorView | null>(null);
  const failed = useRef<Attempt | null>(null);
  const activeKey = useRef<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const base = '/jobs/' + encodeURIComponent(jobId) + '/coordinator';

  /** Serializa solicitudes y descarta respuestas desmontadas, incluso en StrictMode. */
  const perform = useCallback(async (attempt?: Attempt, discard = false): Promise<boolean> => {
    if (!userId || activeKey.current !== key || pending.current) return false;
    const controller = new AbortController();
    pending.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    setBusy(true); setError('');
    try {
      const response = await apiClient<ApiResult<CoordinatorView>>(base + (attempt?.path ?? ''), {
        method: attempt ? 'POST' : 'GET', signal: controller.signal,
        ...(attempt ? { body: JSON.stringify(attempt.body) } : {}),
      });
      if (activeKey.current !== key || pending.current !== controller) return false;
      latest.current = response.datos; setView(response.datos);
      if (attempt || discard) { failed.current = null; setFailedAttempt(null); }
      return true;
    } catch (failure) {
      if (activeKey.current === key && pending.current === controller) {
        setError(controller.signal.aborted ? 'La solicitud tardo demasiado. Su resultado aun no esta confirmado.'
          : failure instanceof Error ? failure.message : 'No pudimos conectar con OfiAI.');
        if (attempt) { failed.current = attempt; setFailedAttempt(attempt); }
      }
      return false;
    } finally {
      clearTimeout(timeout);
      if (pending.current === controller) { pending.current = null; if (activeKey.current === key) setBusy(false); }
    }
  }, [base, key, userId]);

  useEffect(() => {
    activeKey.current = key; latest.current = null; failed.current = null;
    setStateKey(key); setView(null); setFailedAttempt(null); setError(''); setBusy(Boolean(userId));
    if (userId) void perform();
    return () => { activeKey.current = null; pending.current?.abort(); pending.current = null; };
  }, [perform, key, userId]);

  // Solo consultas: recupera la entrega interna y las acciones al llegar la fecha acordada.
  useEffect(() => {
    if (stateKey !== key || busy || error || failedAttempt) return;
    const workflow = view?.workflow;
    const delay = workflow?.state === 'CONTACT_PENDING' ? 60000
      : workflow?.state === 'CONFIRMED' && workflow.schedule && Date.parse(workflow.schedule.startsAt) > Date.now()
        ? Math.min(Date.parse(workflow.schedule.startsAt) - Date.now() + 100, 2147483647) : null;
    if (delay === null) return;
    const timer = setTimeout(() => { void perform(); }, delay);
    return () => clearTimeout(timer);
  }, [view, stateKey, key, busy, error, failedAttempt, perform]);

  /** Solo la empresa inicia tras reconocer explicitamente los limites de la estimacion. */
  function start(acknowledgeEstimate: boolean): Promise<boolean> {
    if (activeKey.current !== key || !acknowledgeEstimate || !latest.current || !canStart(latest.current) || failed.current) return Promise.resolve(false);
    return perform({ path: '', body: { acknowledgeEstimate: true, idempotencyKey: crypto.randomUUID() } });
  }

  /** Usa la ultima revision autoritativa, nunca un contador local. */
  function command(input: CoordinatorInput): Promise<boolean> {
    const current = latest.current;
    if (activeKey.current !== key || !current?.workflow || failed.current || !canCommand(current, input.action)) return Promise.resolve(false);
    return perform({ path: '/commands', body: { ...input, workflowId: current.workflow.id, revision: current.workflow.revision, idempotencyKey: crypto.randomUUID() } });
  }

  return { view: stateKey === key ? view : null, busy: stateKey === key ? busy : Boolean(userId),
    error: stateKey === key ? error : '', failedAttempt: stateKey === key ? failedAttempt : null, start, command,
    reload: () => perform(),
    retry: () => failed.current ? perform(failed.current) : perform(),
    discardAndReload: () => perform(undefined, true) };
}
