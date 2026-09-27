/** @archivo CoordinatorForms.tsx @descripcion Formularios completos y consentimiento antes de cada comando. */
import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { PricingFields } from './JobPricingPage';
import { coordinatorActions } from './coordinatorPresentation';
import type { CoordinatorInput } from '../lib/api/coordinator';
import type { CoordinatorAction, CoordinatorView } from '../../../shared/coordinator';
import type { PricingInputs, PricingQuote } from '../../../shared/pricing';

/** Representa fecha local para controles HTML, sin perder el offset al enviar. */
function localInput(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/** Los controles editan un borrador; solo submit produce un comando. */
export function CoordinatorCommandForm({ action, view, disabled, onSubmit, onClose }: {
  action: CoordinatorAction; view: CoordinatorView; disabled: boolean;
  onSubmit: (input: CoordinatorInput) => Promise<boolean>; onClose: () => void;
}) {
  const previous = action === 'counter_offer' ? view.workflow?.offer?.quote : null;
  const [terms, setTerms] = useState<PricingInputs>(() => ({
    currency: previous?.currency ?? view.job.budget.currency ?? 'ARS',
    scope: previous?.scope ?? view.job.estimatedScope ?? '',
    unit: previous?.unit ?? 'hour', quantity: previous?.quantity ?? 1,
    materials: previous?.materials ?? 'unknown', taxes: previous?.taxes ?? 'unknown',
    materialsCost: null, requiredExperienceYears: null,
  }));
  const [quoteId] = useState(() => crypto.randomUUID());
  const [label, setLabel] = useState(previous?.label ?? '');
  const [amount, setAmount] = useState(previous ? String(previous.amount) : '');
  const [validUntil, setValidUntil] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const definition = coordinatorActions[action];
  const Icon = definition.icon;
  const isQuote = action === 'submit_quote' || action === 'counter_offer';
  const today = localInput(new Date()).slice(0, 10);
  const nextYear = new Date(); nextYear.setFullYear(nextYear.getFullYear() + 1);
  const latestExpiry = localInput(nextYear).slice(0, 10);

  /** Valida los terminos, preservando el borrador si el servidor rechaza la operacion. */
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (disabled || !consent || !event.currentTarget.reportValidity()) return;
    setError('');
    if ((action === 'cancel' || note.trim()) && note.trim().length < 3) {
      setError('Indica una nota de al menos 3 caracteres.'); return;
    }
    const input: CoordinatorInput = { action, ...(note.trim() ? { note: note.trim() } : {}) };
    if (isQuote) {
      if (terms.materials === 'unknown' || terms.taxes === 'unknown') {
        setError('Confirma si materiales e impuestos estan incluidos o excluidos.'); return;
      }
      if (label.trim().length < 2 || terms.scope.trim().length < 8 || !Number.isFinite(Number(amount)) || Number(amount) <= 0
        || !Number.isFinite(terms.quantity) || terms.quantity <= 0 || validUntil < today || validUntil > latestExpiry) {
        setError('Completa un presupuesto vigente, con alcance e importe validos.'); return;
      }
      const quote: PricingQuote = { id: quoteId, label: label.trim(), amount: Number(amount), validUntil,
        currency: terms.currency, scope: terms.scope.trim(), unit: terms.unit, quantity: terms.quantity,
        materials: terms.materials, taxes: terms.taxes };
      input.quote = quote;
    }
    if (action === 'propose_schedule') {
      const start = new Date(startsAt); const end = new Date(endsAt);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start.getTime() <= Date.now()
        || start.getTime() > Date.now() + 366 * 86400000 || end.getTime() - start.getTime() > 90 * 86400000
        || end <= start || localInput(start) !== startsAt || localInput(end) !== endsAt) {
        setError('Indica un inicio futuro dentro de un ano y un fin posterior, con hasta 90 dias de duracion.'); return;
      }
      input.schedule = { startsAt: start.toISOString(), endsAt: end.toISOString() };
    }
    if (await onSubmit(input)) onClose();
  }

  return <form className="coordinator-form" aria-label={definition.label} onSubmit={event => { void submit(event); }}>
    <div className="coordinator-heading"><h3>{definition.label}</h3>
      <button type="button" className="ofi-btn-secondary coordinator-icon" title="Cerrar formulario" aria-label="Cerrar formulario" disabled={disabled} onClick={onClose}><X size={18} /></button></div>
    <fieldset disabled={disabled}>
      {isQuote && <>
        <div className="pricing-fields">
          <label>Referencia del presupuesto<input className="ofi-input" required minLength={2} maxLength={100} value={label} onChange={event => setLabel(event.target.value)} /></label>
          <label>Importe total<input aria-describedby="coordinator-total" className="ofi-input" required type="number" min=".01" max="1000000000" step=".01" value={amount} onChange={event => setAmount(event.target.value)} /></label>
          <label>Valido hasta<input className="ofi-input" required type="date" min={today} max={latestExpiry} value={validUntil} onChange={event => setValidUntil(event.target.value)} /></label>
        </div>
        <p id="coordinator-total">Importe total para todo el alcance y la cantidad indicada; no es una tarifa por unidad.</p>
        <PricingFields value={terms} onChange={setTerms} quote requireCoverage />
      </>}
      {action === 'propose_schedule' && <>
        <p>Zona horaria: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
        <div className="pricing-fields">
          <label>Inicio<input className="ofi-input" required type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)} /></label>
          <label>Fin<input className="ofi-input" required type="datetime-local" value={endsAt} onChange={event => setEndsAt(event.target.value)} /></label>
        </div>
      </>}
      {action === 'cancel' && <p>{view.role === 'empresa'
        ? 'Al cancelar como empresa, tambien se cancela el trabajo. Debera reabrirse antes de una nueva coordinacion.'
        : 'Al rechazar como profesional, se libera tu seleccion y el trabajo queda publicado para otra seleccion.'}</p>}
      <label className="coordinator-note">{action === 'cancel' ? 'Motivo de cancelacion (obligatorio)' : 'Nota para la otra parte (opcional)'}<textarea className="ofi-input" required={action === 'cancel'} minLength={3} maxLength={500} value={note} onChange={event => setNote(event.target.value)} /></label>
      <label className="coordinator-consent"><input required type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /><span>{definition.consent}</span></label>
      {error && <p role="alert" className="coordinator-error">{error}</p>}
      <button type="submit" className={action === 'cancel' ? 'ofi-btn-secondary coordinator-danger' : 'ofi-btn-primary'} disabled={disabled || !consent}><Icon size={17} />{definition.label}</button>
    </fieldset>
  </form>;
}
