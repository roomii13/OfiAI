/** @archivo coordinator.ts @descripcion Coordinator autenticado y reintentos con identidad y revision inmutables. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { randomUUID } from 'expo-crypto';
import { request } from './api';
import type { ApiResult } from '../../../shared/contracts';
import type { CoordinatorCommand, CoordinatorList, CoordinatorStart, CoordinatorView } from '../../../shared/coordinator';

export interface CoordinatorPending {
  suffix: '' | '/commands';
  body: CoordinatorStart | CoordinatorCommand;
}

/** Usa el generador nativo UUID v4 incluido en Expo 50. */
export function coordinatorId(): string { return randomUUID(); }

/** La empresa puede reiniciar una coordinacion cancelada si el Job sigue publicado. */
export function canStartCoordinator(view: CoordinatorView): boolean {
  return view.role === 'empresa' && (!view.workflow || (view.workflow.state === 'CANCELLED' && view.job.status === 'publicado'));
}

/** Serializa solicitudes, impone timeout y descarta respuestas fuera de foco. */
function useCoordinatorTransport() {
  const focused = useIsFocused();
  const active = useRef(focused);
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    active.current = focused; setBusy(false);
    return () => { active.current = false; controller.current?.abort(); controller.current = null; };
  }, [focused]);

  /** Acepta una respuesta solo mientras siga vigente su controlador. */
  const execute = useCallback(async <T,>(path: string, body?: unknown): Promise<T | null> => {
    if (!active.current || controller.current) return null;
    const current = new AbortController(); controller.current = current;
    const timeout = setTimeout(() => current.abort(), 30000);
    setBusy(true); setError('');
    try {
      const result = await request<ApiResult<T>>(path, {
        method: body === undefined ? 'GET' : 'POST', signal: current.signal,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!result.exito || result.datos == null) throw new Error(result.mensaje || 'La API no devolvio datos validos.');
      if (current.signal.aborted) throw new Error('Solicitud interrumpida.');
      return active.current && controller.current === current ? result.datos : null;
    } catch (failure) {
      if (active.current && controller.current === current) setError(current.signal.aborted
        ? 'La solicitud esta tardando. Consulta el estado o reintenta el mismo envio.'
        : failure instanceof Error ? failure.message : 'No pudimos conectar con OfiAI.');
      return null;
    } finally {
      clearTimeout(timeout);
      if (controller.current === current) { controller.current = null; if (active.current) setBusy(false); }
    }
  }, []);
  return { focused, busy, error, execute, setError };
}

/** Conserva el intento hasta exito o descarte explicito. Montar con key de cuenta y Job. */
export function useCoordinator(jobId: string) {
  const transport = useCoordinatorTransport();
  const { execute, focused, setError } = transport;
  const base = '/jobs/' + encodeURIComponent(jobId) + '/coordinator';
  const [view, setView] = useState<CoordinatorView | null>(null);
  const [pending, setPending] = useState<CoordinatorPending | null>(null);
  const attempt = useRef<CoordinatorPending | null>(null);
  const sending = useRef(false);

  /** Consulta sin iniciar el acuerdo ni alterar un intento pendiente. */
  const reload = useCallback(async (): Promise<boolean> => {
    const result = await execute<CoordinatorView>(base);
    if (result) setView(result);
    return result !== null;
  }, [base, execute]);
  useEffect(() => { if (focused) void reload(); }, [focused, reload]);

  /** Reenvia el cuerpo original incluso si el servidor ya avanzo de revision. */
  async function retry(): Promise<boolean> {
    if (!attempt.current || sending.current || transport.busy || !focused) return false;
    sending.current = true;
    try {
      const result = await execute<CoordinatorView>(base + attempt.current.suffix, attempt.current.body);
      if (!result) return false;
      setView(result); attempt.current = null; setPending(null); return true;
    } finally { sending.current = false; }
  }

  /** Guarda UUID, workflowId y revision antes de enviar para bloquear dobles pulsaciones. */
  async function send(command?: Omit<CoordinatorCommand, 'idempotencyKey'>): Promise<boolean> {
    if (!view || attempt.current || transport.busy || !focused) return false;
    if (!command && !canStartCoordinator(view)) return false;
    if (command && (!view.workflow || command.workflowId !== view.workflow.id || command.revision !== view.workflow.revision
      || !view.advice.actions.includes(command.action))) {
      setError('La accion ya no esta disponible. Actualiza el estado y revisa los cambios.'); return false;
    }
    try {
      const idempotencyKey = coordinatorId();
      const next: CoordinatorPending = command
        ? { suffix: '/commands', body: { ...command, idempotencyKey } }
        : { suffix: '', body: { idempotencyKey, acknowledgeEstimate: true } };
      attempt.current = next; setPending(next);
      return await retry();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo preparar el envio.'); return false;
    }
  }

  /** Descarta solo tras consentimiento del usuario y lectura satisfactoria del estado real. */
  async function discardAndReload(): Promise<boolean> {
    if (sending.current || transport.busy || !await reload()) return false;
    attempt.current = null; setPending(null); return true;
  }
  return { view, pending, busy: transport.busy, error: transport.error, reload, send, retry, discardAndReload };
}

/** Bandeja por cuenta que avanza el cursor solamente al recibir la pagina completa. */
export function useCoordinatorList() {
  const { execute, focused, busy, error } = useCoordinatorTransport();
  const [data, setData] = useState<CoordinatorList | null>(null);
  /** Refresca desde el inicio o agrega una pagina sin repetir Jobs. */
  const load = useCallback(async (cursor?: string): Promise<void> => {
    const page = await execute<CoordinatorList>('/coordinator' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''));
    if (page) setData(previous => ({
      items: cursor ? [...new Map([...(previous?.items ?? []), ...page.items].map(item => [item.jobId, item])).values()] : page.items,
      nextCursor: page.nextCursor,
    }));
  }, [execute]);
  useEffect(() => { if (focused) void load(); }, [focused, load]);
  /** Actualiza la bandeja desde el servidor. */
  function reload(): void { void load(); }
  /** Reutiliza el cursor vigente tambien despues de una falla. */
  function loadMore(): void { if (data?.nextCursor) void load(data.nextCursor); }
  return { data, busy, error, reload, loadMore };
}
