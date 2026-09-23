/** @archivo pricing.ts @descripcion Estado de Pricing por cuenta y Job; sin calculos ni claves en frontend. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from './client';
import type { ApiResult } from '../../../../shared/contracts';
import type { PricingView, PricingInputs, PricingQuote } from '../../../../shared/pricing';
/** Operaciones con timeout, cancelacion y revisiones autoritativas. */
export function usePricing(jobId: string) {
  const [view, setView] = useState<PricingView | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const active = useRef(true); const pending = useRef<AbortController | null>(null);
  const base = '/jobs/' + encodeURIComponent(jobId) + '/pricing';
  /** Serializa acciones; no reintenta escrituras ni muestra datos de otra solicitud. */
  const perform = useCallback(async (path = '', method = 'GET', body?: unknown): Promise<boolean> => {
    if (pending.current) return false;
    const controller = new AbortController(); pending.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60000);
    setBusy(true); setError('');
    /** Desenvuelve el contrato estandar. */
    async function request(suffix: string, verb: string, payload?: unknown): Promise<PricingView> {
      const response = await apiClient<ApiResult<PricingView>>(base + suffix, { method: verb, signal: controller.signal,
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
      return response.datos;
    }
    try {
      let data = await request(path, method, body);
      if (data.stale && !data.processing && !['cancelado', 'completado'].includes(data.job.status)) data = await request('', 'POST', {});
      while (data.processing && !controller.signal.aborted) {
        await new Promise<void>(resolve => setTimeout(resolve, 2000));
        data = await request('', 'GET');
      }
      if (active.current && pending.current === controller) setView(data);
      return true;
    } catch (failure) {
      if (active.current && pending.current === controller) setError(controller.signal.aborted ? 'La estimacion esta tardando. Consulta nuevamente su estado.'
        : failure instanceof Error ? failure.message : 'No pudimos conectar con OfiAI.');
      return false;
    } finally {
      clearTimeout(timeout); if (pending.current === controller) { pending.current = null; if (active.current) setBusy(false); }
    }
  }, [base]);
  useEffect(() => { active.current = true; void perform(); return () => { active.current = false; pending.current?.abort(); pending.current = null; }; }, [perform]);
  return { view, error, busy, reload: () => perform(),
    saveInputs: (inputs: PricingInputs) => perform('/inputs', 'PUT', { revision: view?.revision ?? 0, inputs }),
    saveQuote: (quote: PricingQuote) => perform('/quotes', 'POST', { revision: view?.revision ?? 0, quote }) };
}
