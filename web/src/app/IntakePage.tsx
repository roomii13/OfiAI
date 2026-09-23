/**
 * @archivo IntakePage.tsx
 * @descripcion Conversacion privada, resumen vivo y confirmacion explicita de solicitudes.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Loader2, MessageSquare, Pencil, Plus, RefreshCw, Send, Sparkles, X } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../lib/api/client';
import { useApiResource } from '../lib/api/resources';
import type { ApiResult } from '../../../shared/contracts';
import type { IntakeField, IntakeSession, IntakeSessionSummary } from '../../../shared/intake';

const missingLabels: Record<IntakeField, string> = {
  category: 'Categoria', title: 'Titulo', description: 'Detalle del servicio', location: 'Pais y ciudad',
  urgency: 'Urgencia', preferredDate: 'Fecha deseada', estimatedScope: 'Cantidad o alcance',
  requirements: 'Requisitos especiales', budget: 'Presupuesto', attachments: 'Fotos o documentos', workType: 'Modalidad',
};
const urgencyLabels = { low: 'Baja', normal: 'Normal', high: 'Alta', emergency: 'Emergencia' };
const statusLabels = { active: 'En curso', ready: 'Lista para revisar', published: 'Publicada', abandoned: 'Cerrada' };

/** Limita la espera HTTP sin reintentar automaticamente operaciones de escritura. */
async function intakeRequest(endpoint: string, body: unknown): Promise<IntakeSession> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75000);
  try {
    const response = await apiClient<ApiResult<IntakeSession>>(endpoint, { method: 'POST', body: JSON.stringify(body), signal: controller.signal });
    return response.datos;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('La respuesta esta tardando. Actualiza la conversacion antes de reintentar.');
    if (error instanceof TypeError) throw new Error('No pudimos conectar. Tu mensaje sigue aqui; revisa la conexion.');
    throw error;
  } finally { clearTimeout(timeout); }
}

/** Renderiza el flujo de recepcion con datos de servidor y sin claves ni SDK de Gemini. */
export function IntakePage() {
  const { user } = useAuth();
  return <IntakeConversation key={user?.id ?? 'anonymous'} />;
}

/** Aisla borradores y respuestas en vuelo cuando cambia la cuenta autenticada. */
function IntakeConversation() {
  const [params, setParams] = useSearchParams();
  const id = params.get('session');
  const history = useApiResource<IntakeSessionSummary[]>('/ai/intake/sessions');
  const loaded = useApiResource<IntakeSession>(id ? '/ai/intake/sessions/' + encodeURIComponent(id) : null);
  const [local, setLocal] = useState<IntakeSession | null>(null);
  const session = local?.id === id ? local : loaded.data;
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const locked = useRef(false);
  const alive = useRef(true);
  const activeId = useRef(id);
  activeId.current = id;
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const startId = useRef(crypto.randomUUID());
  const pendingMessage = useRef<{ id: string; content: string; sessionId: string; version: number } | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'nearest' }); }, [session?.messages.length, busy]);
  const closed = session?.status === 'published' || session?.status === 'abandoned';

  /** Serializa las acciones y descarta respuestas de otra conversacion o pantalla. */
  async function perform(label: string, action: () => Promise<IntakeSession>, after?: () => void): Promise<void> {
    if (locked.current) return;
    locked.current = true; setBusy(label); setError('');
    const origin = id;
    try {
      const result = await action();
      if (!alive.current || activeId.current !== origin) return;
      setLocal(result);
      if (!origin || label === 'new') setParams({ session: result.id });
      history.reload();
      after?.();
    } catch (failure) {
      if (alive.current && activeId.current === origin) setError(failure instanceof Error ? failure.message : 'No pudimos completar la accion. Intenta nuevamente.');
    } finally { locked.current = false; if (alive.current) setBusy(''); }
  }

  /** Reutiliza el identificador al reintentar una creacion cuya respuesta se perdio. */
  function start(): void {
    void perform('new', () => intakeRequest('/ai/intake/sessions', { requestId: startId.current }), () => {
      startId.current = crypto.randomUUID(); setDraft(''); pendingMessage.current = null;
    });
  }

  /** Envia un turno, conservando el texto y la clave de reintento ante fallos de red. */
  function send(event: FormEvent): void {
    event.preventDefault();
    if (!session || !draft.trim() || closed) return;
    const content = draft.trim();
    if (!pendingMessage.current || pendingMessage.current.content !== content || pendingMessage.current.sessionId !== session.id) {
      pendingMessage.current = { id: crypto.randomUUID(), content, sessionId: session.id, version: session.version };
    }
    const command = pendingMessage.current;
    void perform('message', () => intakeRequest('/ai/intake/sessions/' + session.id + '/messages', {
      requestId: command.id, expectedVersion: command.version, message: content,
    }), () => { setDraft(''); pendingMessage.current = null; });
  }

  /** Recupera la version autoritativa cuando otra ventana pudo modificarla. */
  function refresh(): void {
    if (locked.current) return;
    setLocal(null); pendingMessage.current = null; loaded.reload(); history.reload(); setError('');
  }

  /** Cambia de conversacion solo cuando no existe una operacion pendiente. */
  function selectSession(value: string): void {
    if (locked.current) return;
    setLocal(null); setDraft(''); setError(''); pendingMessage.current = null;
    setParams(value ? { session: value } : {});
  }

  const data = session?.extractedData;
  return <DashboardLayout>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase text-brand-700">AI Intake Agent</p><h1 className="mt-1 text-2xl font-bold">Tu proxima solicitud</h1></div>
      <div className="flex items-center gap-2">
        <button className="ofi-btn-secondary" onClick={refresh} disabled={Boolean(busy)} title="Actualizar conversaciones" aria-label="Actualizar conversaciones"><RefreshCw className="h-4 w-4" /></button>
        <button className="ofi-btn-primary" onClick={start} disabled={Boolean(busy)}><Plus className="h-4 w-4" />Nueva conversacion</button>
      </div>
    </div>
    <label className="mb-5 block text-sm font-medium" htmlFor="intake-history">Conversaciones</label>
    <select id="intake-history" className="ofi-input mb-5" value={id ?? ''} disabled={Boolean(busy)} onChange={event => selectSession(event.target.value)}>
      <option value="">Seleccionar conversacion</option>
      {id && !history.data?.some(item => item.id === id) && <option value={id}>Conversacion actual</option>}
      {history.data?.map(item => <option key={item.id} value={item.id}>{item.title} · {statusLabels[item.status]}</option>)}
    </select>
    {(error || loaded.error || history.error) && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error || loaded.error || history.error}</div>}
    {id && loaded.loading && !local && <p role="status">Recuperando conversacion...</p>}
    <div className="ofi-intake-grid">
      <section className="ofi-intake-chat" aria-label="Conversacion con OfiAI">
        <div className="flex items-center gap-2 border-b border-border p-4 font-semibold"><Sparkles className="h-5 w-5 text-brand-600" />Asistente de solicitudes</div>
        <div className="ofi-intake-messages" role="log" aria-live="polite" aria-relevant="additions">
          {!session && <p className="text-gray-600">Hola, contame que necesita tu empresa. Podemos empezar una nueva conversacion cuando quieras.</p>}
          {session?.messages.map(message => <div key={message.id} className={'ofi-intake-message ' + (message.role === 'user' ? 'ofi-intake-user' : 'ofi-intake-agent')}>
            <p className="mb-1 text-xs font-semibold">{message.role === 'user' ? 'Vos' : 'OfiAI'}</p>
            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
          </div>)}
          {busy === 'message' && <p role="status" className="flex items-center gap-2 text-sm text-brand-700"><Loader2 className="h-4 w-4 animate-spin" />La IA esta analizando...</p>}
          <div ref={end} />
        </div>
        <form className="border-t border-border p-4" onSubmit={send}>
          <label className="mb-2 block text-sm font-medium" htmlFor="intake-message">Tu mensaje</label>
          <div className="flex items-end gap-2">
            <textarea ref={input} id="intake-message" className="ofi-input min-h-24 resize-y" rows={3} maxLength={4000} value={draft}
              disabled={!session || closed || Boolean(busy)} onChange={event => setDraft(event.target.value)} />
            <button className="ofi-btn-primary h-11 shrink-0" type="submit" title="Enviar mensaje" aria-label="Enviar mensaje" disabled={!session || closed || Boolean(busy) || !draft.trim()}><Send className="h-4 w-4" /></button>
          </div>
        </form>
      </section>
      <aside className="ofi-intake-summary" aria-label="Resumen de la solicitud">
        <h2 className="text-lg font-semibold">Resumen del trabajo</h2>
        <p className="mt-1 text-sm text-gray-600">{session ? statusLabels[session.status] : 'Sin iniciar'}</p>
        <label className="mt-5 block text-sm" htmlFor="intake-progress">Progreso · {session?.completionPercentage ?? 0}%</label>
        <progress id="intake-progress" className="my-2 h-2 w-full accent-violet-600" value={session?.completionPercentage ?? 0} max={100} />
        <dl className="ofi-intake-details">
          {Object.entries({
            Trabajo: data?.title, Categoria: data?.category,
            Ubicacion: [data?.location.city, data?.location.region, data?.location.country].filter(Boolean).join(', '),
            Urgencia: data?.urgency ? urgencyLabels[data.urgency] : null,
            Presupuesto: data?.budgetStatus === 'to_quote' ? 'A cotizar' : data?.budget.min !== null && data?.budget.min !== undefined || data?.budget.max !== null && data?.budget.max !== undefined
              ? [data?.budget.min === null ? 'Sin minimo' : data?.budget.min, data?.budget.max === null ? 'Sin maximo' : data?.budget.max, data?.budget.currency ?? 'Moneda por confirmar'].join(' · ') : null,
            Fecha: data?.preferredDate, Alcance: data?.estimatedScope, Modalidad: data?.workType,
            Requisitos: data?.requirements.join(', '),
            Adjuntos: data?.attachmentsRequired ? data.attachmentReason ?? 'Se recomiendan fotos o documentos' : data?.attachmentsRequired === false ? 'No requeridos' : null,
            Equipo: data?.multipleProfessionals ? data.professionalTypes.join(', ') || 'Podrian necesitarse varios profesionales' : data?.multipleProfessionals === false ? 'Un profesional' : null,
          }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Por definir'}</dd></div>)}
        </dl>
        {data?.description && <p className="my-4 whitespace-pre-wrap text-sm">{data.description}</p>}
        {Boolean(session?.missingInformation.length) && <div className="mt-5"><h3 className="text-sm font-semibold">Falta completar</h3><ul className="mt-2 list-inside list-disc text-sm text-gray-600">{session?.missingInformation.map(field => <li key={field}>{missingLabels[field]}</li>)}</ul></div>}
        {session?.readyToCreateJob && !closed && <div className="mt-5 grid gap-2">
          <button className="ofi-btn-primary justify-center" disabled={Boolean(busy) || Boolean(draft.trim())}
            onClick={() => void perform('confirm', () => intakeRequest('/ai/intake/sessions/' + session.id + '/confirm', { confirmed: true, expectedVersion: session.version }))}>
            <Check className="h-4 w-4" />{busy === 'confirm' ? 'Publicando...' : 'Publicar solicitud'}
          </button>
          <button className="ofi-btn-secondary justify-center" disabled={Boolean(busy)} onClick={() => { setDraft('Quiero corregir: '); input.current?.focus(); }}><Pencil className="h-4 w-4" />Editar informacion</button>
          <button className="ofi-btn-secondary justify-center" disabled={Boolean(busy)} onClick={() => input.current?.focus()}><MessageSquare className="h-4 w-4" />Seguir hablando con IA</button>
        </div>}
        {session?.status === 'published' && <div role="status" className="mt-5 border-t border-emerald-200 pt-4"><p className="font-semibold text-emerald-800">Solicitud publicada</p>
          {session.jobId && <Link to={'/dashboard/company/jobs/' + encodeURIComponent(session.jobId) + '/matches'} className="ofi-btn-primary mt-3"><Sparkles size={16} />Ver profesionales recomendados</Link>}
          <Link to="/jobs" className="mt-2 inline-block font-semibold text-brand-700">Ver mis trabajos</Link></div>}
        {session && !closed && <button className="mt-6 flex items-center gap-2 text-sm text-gray-600" disabled={Boolean(busy)} onClick={() => {
          if (window.confirm('Cerrar esta conversacion sin publicar?')) void perform('abandon', () => intakeRequest('/ai/intake/sessions/' + session.id + '/abandon', { expectedVersion: session.version }));
        }}><X className="h-4 w-4" />Cerrar conversacion</button>}
      </aside>
    </div>
  </DashboardLayout>;
}
