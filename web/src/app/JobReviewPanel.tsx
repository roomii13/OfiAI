/** @archivo JobReviewPanel.tsx @descripcion Evaluacion de una contratacion finalizada y verificada por el backend. */
import { useState, type FormEvent } from 'react';
import { Star, Send, RefreshCw } from 'lucide-react';
import { api } from '../lib/api/client';
import { useApiResource } from '../lib/api/resources';
import type { JobReviewState } from '../../../shared/reviews';

/** No habilita el formulario hasta recibir permiso efectivo del servidor. */
export function JobReviewPanel({ jobId }: { jobId: string }) {
  const path = '/jobs/' + encodeURIComponent(jobId) + '/review';
  const resource = useApiResource<JobReviewState>(path);
  const [rating, setRating] = useState(0); const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  /** Guarda una sola evaluacion por Job; los reintentos son idempotentes en Firestore. */
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); if (busy || !rating || !resource.data?.canReview) return;
    setBusy(true); setMessage('');
    try {
      await api.post(path, { calificacion: rating, comentario: comment.trim() });
      setMessage('Evaluacion registrada. Gracias por compartir tu experiencia.'); resource.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No pudimos guardar la evaluacion.'); }
    finally { setBusy(false); }
  }
  return <section className="coordinator-section" aria-label="Evaluacion del trabajo">
    <h2>Evaluacion del trabajo</h2>
    {resource.loading && <p role="status">Consultando evaluacion...</p>}
    {resource.error && <div role="alert"><p>{resource.error}</p><button className="ofi-btn-secondary" onClick={resource.reload} title="Reintentar evaluacion"><RefreshCw size={18} /></button></div>}
    {resource.data?.review && <div>
      <p><Star size={18} aria-hidden="true" /> {resource.data.review.calificacion} / 5 · Contratacion verificada</p>
      <p className="whitespace-pre-wrap break-words">{resource.data.review.comentario}</p>
    </div>}
    {resource.data?.canReview && !resource.loading && <form onSubmit={submit} className="mt-4 grid gap-3">
      <fieldset disabled={busy}><legend className="mb-2">Tu calificacion</legend>
        <div className="flex gap-2">{[1, 2, 3, 4, 5].map(value => <button key={value} type="button"
          className="flex h-11 w-11 items-center justify-center rounded border border-gray-300 text-amber-600"
          aria-label={value + (value === 1 ? ' estrella' : ' estrellas')} aria-pressed={rating === value} title={value + ' / 5'}
          onClick={() => setRating(value)}><Star size={23} fill={value <= rating ? 'currentColor' : 'none'} /></button>)}</div>
      </fieldset>
      <label className="grid gap-1">Tu experiencia<textarea className="ofi-input" rows={4} minLength={10} maxLength={1500}
        required disabled={busy} value={comment} onChange={event => setComment(event.target.value)} /></label>
      <button className="ofi-btn-primary justify-center sm:w-fit" disabled={busy || !rating || comment.trim().length < 10}>
        <Send size={17} />{busy ? 'Guardando...' : 'Publicar evaluacion'}</button>
    </form>}
    {resource.data && !resource.data.canReview && !resource.data.review && <p>El contratante podra evaluar una vez confirmada la finalizacion.</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
