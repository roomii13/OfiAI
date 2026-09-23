/**
 * @archivo matching.ts
 * @descripcion Estado HTTP de recomendaciones y progreso, aislado por Job y cuenta.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from './client';
import type { ApiResult } from '../../../../shared/contracts';
import type { MatchingResult, ProfessionalMatch } from '../../../../shared/matching';

/** Lee o ejecuta una operacion acotada sin reintentar escrituras. */
async function matchingRequest<T>(endpoint: string, signal: AbortSignal, body?: unknown): Promise<T> {
  const result = await apiClient<ApiResult<T>>(endpoint, { method: body === undefined ? 'GET' : 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal });
  return result.datos;
}

/** Administra cache de servidor y consultas de progreso; nunca calcula un ranking en React. */
export function useMatching(jobId: string) {
  const base = '/jobs/' + encodeURIComponent(jobId);
  const [result, setResult] = useState<MatchingResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [slow, setSlow] = useState(false);
  const [revision, setRevision] = useState(0);
  const [action, setAction] = useState('');
  const alive = useRef(true);
  const actionLock = useRef(false);
  const controllers = useRef(new Set<AbortController>());
  useEffect(() => { alive.current = true; const pending = controllers.current; return () => {
    alive.current = false; pending.forEach(controller => controller.abort());
  }; }, []);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    let poll: ReturnType<typeof setInterval> | undefined;
    let polling = false;
    let finished = false;
    const timeout = setTimeout(() => controller.abort(), 75000);
    const slowTimer = setTimeout(() => { if (active) setSlow(true); }, 10000);
    setBusy(true); setError(''); setSlow(false); setResult(null);
    /** Actualiza solo la pantalla vigente y emite una vista por corrida. */
    function accept(value: MatchingResult): void {
      if (!active) return;
      setResult(value);
      if (['completed', 'fallback'].includes(value.status) && value.runId) {
        void matchingRequest(base + '/matches/events', controller.signal, { type: 'match_viewed', runId: value.runId }).catch(() => undefined);
      }
    }
    /** Recupera etapas autoritativas mientras el POST sigue abierto. */
    async function progress(): Promise<void> {
      if (polling || !active) return;
      polling = true;
      try { const value = await matchingRequest<MatchingResult>(base + '/matches', controller.signal); if (active && !finished) setResult(value); }
      catch { /* La operacion principal conserva el error de conexion. */ }
      finally { polling = false; }
    }
    /** Inicia solo si el cache es inexistente o invalido. */
    async function load(): Promise<void> {
      try {
        let value = await matchingRequest<MatchingResult>(base + '/matches', controller.signal);
        if (!active) return;
        setResult(value);
        if (value.status === 'pending' || value.status === 'failed') {
          poll = setInterval(() => { void progress(); }, 3000);
          value = await matchingRequest<MatchingResult>(base + '/matching', controller.signal, {});
          clearInterval(poll);
        }
        while (value.status === 'processing' && active && !controller.signal.aborted) {
          await new Promise<void>(resolve => setTimeout(resolve, 3000));
          value = await matchingRequest<MatchingResult>(base + '/matches', controller.signal);
          if (active) setResult(value);
        }
        finished = true; accept(value);
        if (value.status === 'pending' || value.status === 'failed') throw new Error(value.status === 'failed' ? value.message : 'La busqueda necesita un nuevo intento.');
      } catch (failure) {
        if (active) setError(controller.signal.aborted ? 'La busqueda esta tardando. Consulta nuevamente para recuperar su estado.'
          : failure instanceof Error ? failure.message : 'No pudimos conectar con OfiAI.');
      } finally {
        clearTimeout(timeout); clearTimeout(slowTimer); clearInterval(poll);
        if (active) setBusy(false);
      }
    }
    void load();
    return () => { active = false; controller.abort(); clearTimeout(timeout); clearTimeout(slowTimer); clearInterval(poll); };
  }, [base, revision]);

  /** Serializa perfil y seleccion y cancela al salir o cambiar de cuenta. */
  async function perform<T>(name: string, endpoint: string, body?: unknown): Promise<T | null> {
    if (actionLock.current) return null;
    const controller = new AbortController(); controllers.current.add(controller);
    const timeout = setTimeout(() => controller.abort(), 30000);
    actionLock.current = true; setAction(name); setError('');
    try { const value = await matchingRequest<T>(endpoint, controller.signal, body); return alive.current ? value : null; }
    catch (failure) {
      if (alive.current) setError(controller.signal.aborted ? 'La accion esta tardando. Consulta el estado antes de reintentar.'
        : failure instanceof Error ? failure.message : 'No pudimos completar la accion.');
      return null;
    } finally {
      controllers.current.delete(controller); clearTimeout(timeout); actionLock.current = false;
      if (alive.current) setAction('');
    }
  }
  /** Obtiene exclusivamente el perfil publico de un candidato del Job. */
  async function profile(id: string): Promise<ProfessionalMatch | null> {
    return perform('profile', base + '/matches/' + encodeURIComponent(id) + '/profile');
  }
  /** Persiste selected sin asignar, contactar ni contratar al profesional. */
  async function select(id: string): Promise<void> {
    if (!result?.runId) return;
    const value = await perform<MatchingResult>('select', base + '/matches/' + encodeURIComponent(id) + '/select', { runId: result.runId });
    if (value) setResult(value);
  }
  return { result, error, busy, slow, action, reload, profile, select };
}
