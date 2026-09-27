/** @archivo CoordinatorActionSheet.tsx @descripcion Formularios y confirmaciones explicitas para comandos del servidor. */
import { useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';
import type { CoordinatorAction, CoordinatorCommand, CoordinatorView } from '../../../shared/coordinator';
import { coordinatorId, type useCoordinator } from '../lib/coordinator';
import { coordinatorNote, parseCoordinatorQuote, parseCoordinatorSchedule, quoteDraft } from '../lib/coordinatorForms';
import { coordinatorActions, quoteCoverage, quoteUnits } from '../lib/coordinatorPresentation';
import { useThemeMobile } from '../providers/theme';
import { CoordinatorButton, CoordinatorChoices, CoordinatorConsent, CoordinatorField, CoordinatorSheet, coordinatorStyles as s } from './CoordinatorUi';
import { CoordinatorQuoteTerms, CoordinatorScheduleTerms } from './CoordinatorTerms';

export type CoordinatorSheetAction = CoordinatorAction | 'start' | 'retry' | 'discard';
const confirmations: Record<CoordinatorAction, string> = {
  contact: 'Confirma el envio de una invitacion interna en OfiAI al profesional seleccionado.',
  respond: 'Aceptas conversar sobre este trabajo. No aceptas aun un presupuesto ni un horario.',
  request_quote: 'Solicitas una oferta del profesional, aunque la estimacion tenga informacion insuficiente.',
  submit_quote: 'Envias estos terminos como presupuesto para que la otra parte los revise.',
  review_quote: 'Confirmas que comienzas a revisar el presupuesto. Todavia no lo aceptas.',
  counter_offer: 'Propones nuevos terminos que requieren aceptacion de la otra parte.',
  accept_quote: 'Aceptas expresamente el importe, la moneda, el alcance, los materiales y los impuestos de este presupuesto.',
  propose_schedule: 'Propones este horario. La otra parte debera confirmarlo.',
  confirm_schedule: 'Aceptas expresamente el horario propuesto y el presupuesto acordado.',
  start_work: 'Confirmas que comenzas el trabajo en las condiciones y el horario acordados.',
  request_completion: 'Informas que terminaste el trabajo. La empresa debera verificarlo y confirmar su cierre.',
  complete: 'Confirmas que verificaste el trabajo y aceptas su finalizacion.',
  cancel: 'Cancelas esta coordinacion. Se registrara el motivo en el historial.',
};

/** Captura la revision vista al abrir; cualquier conflicto exige revisar el nuevo estado. */
export function CoordinatorActionSheet({ action, snapshot, coordinator, onClose }: {
  action: CoordinatorSheetAction; snapshot: CoordinatorView; coordinator: ReturnType<typeof useCoordinator>; onClose: () => void;
}) {
  const { colores } = useThemeMobile();
  const [quote, setQuote] = useState(() => quoteDraft('', snapshot.workflow?.offer?.quote,
    snapshot.job.budget.currency ?? 'ARS', snapshot.job.estimatedScope ?? ''));
  const [startsAt, setStartsAt] = useState(snapshot.workflow?.schedule?.startsAt ?? '');
  const [endsAt, setEndsAt] = useState(snapshot.workflow?.schedule?.endsAt ?? '');
  const [note, setNote] = useState(''); const [consent, setConsent] = useState(false); const [error, setError] = useState('');
  const pending = action !== 'discard' ? coordinator.pending : null;
  const pendingCommand = pending && 'action' in pending.body ? pending.body : null;
  const isQuote = action === 'submit_quote' || action === 'counter_offer';
  const isSchedule = action === 'propose_schedule';
  const title = action === 'start' ? 'Iniciar coordinacion' : action === 'retry' ? 'Reintentar envio'
    : action === 'discard' ? 'Descartar reintento' : coordinatorActions[action];
  const acknowledgement = action === 'start' || (pending && !pendingCommand)
    ? 'Reconozco que la estimacion no es una oferta ni un cobro.' : 'Confirmo expresamente esta accion y sus condiciones.';

  /** Cada cambio de terminos requiere renovar el consentimiento. */
  function changeQuote<K extends keyof typeof quote>(key: K, value: (typeof quote)[K]): void {
    setConsent(false); setQuote(previous => ({ ...previous, [key]: value, ...(key === 'unit' && value === 'job' ? { quantity: '1' } : {}) }));
  }

  /** Envia solo tras confirmar, conservando el intento original si hubo una respuesta incierta. */
  async function submit(): Promise<void> {
    if (!consent || coordinator.busy) return;
    setError('');
    try {
      let success: boolean;
      if (action === 'discard') success = await coordinator.discardAndReload();
      else if (pending) success = await coordinator.retry();
      else if (action === 'start') success = await coordinator.send();
      else if (action === 'retry') return;
      else {
        const workflow = snapshot.workflow;
        if (!workflow) throw new Error('Actualiza la coordinacion antes de continuar.');
        const command: Omit<CoordinatorCommand, 'idempotencyKey'> = {
          workflowId: workflow.id, revision: workflow.revision, action,
        };
        const message = coordinatorNote(note, action === 'cancel');
        if (message) command.note = message;
        if (isQuote) command.quote = { ...parseCoordinatorQuote(quote), id: coordinatorId() };
        if (isSchedule) command.schedule = parseCoordinatorSchedule(startsAt, endsAt);
        success = await coordinator.send(command);
      }
      if (success) onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Revisa los datos ingresados.'); }
  }

  return <CoordinatorSheet title={title} onClose={onClose} busy={coordinator.busy}>
    <Text style={{ color: colores.texto }}>{snapshot.job.title}</Text>
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    {coordinator.error ? <Text accessibilityRole="alert" style={s.error}>{coordinator.error}</Text> : null}
    {action === 'discard' ? <Text style={{ color: colores.texto }}>El envio anterior pudo haberse aplicado. Se consultara el estado real antes de habilitar nuevas acciones. No se revierte ninguna operacion.</Text>
      : pending ? <>
        <Text style={{ color: colores.texto }}>Envio pendiente: {pendingCommand ? coordinatorActions[pendingCommand.action] : 'Iniciar coordinacion'}. Se conserva exactamente el mismo contenido.</Text>
        {pendingCommand?.quote && <CoordinatorQuoteTerms quote={pendingCommand.quote} />}
        {pendingCommand?.schedule && <CoordinatorScheduleTerms schedule={pendingCommand.schedule} />}
        {pendingCommand?.note && <Text style={{ color: colores.texto }}>Nota: {pendingCommand.note}</Text>}
      </> : action === 'start' ? <Text style={{ color: colores.texto }}>Inicias la coordinacion con el profesional seleccionado. La estimacion es orientativa; con informacion insuficiente igualmente podras solicitar un presupuesto. No implica contratacion ni cobro.</Text>
        : action !== 'retry' && <Text style={{ color: colores.texto }}>{confirmations[action]}</Text>}
    {!pending && action !== 'discard' && <>
      {isQuote && <>
        <CoordinatorField label="Referencia del presupuesto" value={quote.label} onChange={value => changeQuote('label', value)} disabled={coordinator.busy} />
        <CoordinatorField label="Importe total" value={quote.amount} onChange={value => changeQuote('amount', value)} numeric maxLength={18} disabled={coordinator.busy} />
        <CoordinatorField label="Moneda" value={quote.currency} onChange={value => changeQuote('currency', value.toUpperCase())} maxLength={3} disabled={coordinator.busy} />
        <CoordinatorField label="Alcance del presupuesto" value={quote.scope} onChange={value => changeQuote('scope', value)} multiline maxLength={400} disabled={coordinator.busy} />
        <CoordinatorChoices label="Unidad" value={quote.unit} options={quoteUnits} onChange={value => changeQuote('unit', value)} disabled={coordinator.busy} />
        <CoordinatorField label="Cantidad" value={quote.quantity} onChange={value => changeQuote('quantity', value)} numeric disabled={coordinator.busy || quote.unit === 'job'} />
        <CoordinatorChoices label="Materiales" value={quote.materials} options={quoteCoverage} onChange={value => changeQuote('materials', value)} disabled={coordinator.busy} />
        <CoordinatorChoices label="Impuestos" value={quote.taxes} options={quoteCoverage} onChange={value => changeQuote('taxes', value)} disabled={coordinator.busy} />
        <CoordinatorField label="Valido hasta (AAAA-MM-DD)" value={quote.validUntil} onChange={value => changeQuote('validUntil', value)} maxLength={10} disabled={coordinator.busy} />
      </>}
      {isSchedule && <>
        <CoordinatorField label="Inicio ISO con zona horaria" value={startsAt} onChange={value => { setStartsAt(value); setConsent(false); }} maxLength={35} disabled={coordinator.busy} />
        <CoordinatorField label="Fin ISO con zona horaria" value={endsAt} onChange={value => { setEndsAt(value); setConsent(false); }} maxLength={35} disabled={coordinator.busy} />
      </>}
      {!isQuote && snapshot.workflow?.offer && action !== 'start' && <CoordinatorQuoteTerms quote={snapshot.workflow.offer.quote} />}
      {!isSchedule && snapshot.workflow?.schedule && action !== 'start' && <CoordinatorScheduleTerms schedule={snapshot.workflow.schedule} />}
      {action !== 'start' && action !== 'retry' && <CoordinatorField label={action === 'cancel' ? 'Motivo de cancelacion' : 'Nota (opcional)'} value={note}
        onChange={value => { setNote(value); setConsent(false); }} multiline maxLength={500} disabled={coordinator.busy} />}
    </>}
    <Text style={{ color: colores.textoSuave }}>Esta accion no ejecuta un cobro.</Text>
    <CoordinatorConsent label={acknowledgement} checked={consent} onChange={setConsent} disabled={coordinator.busy} />
    <CoordinatorButton label={pending ? 'Confirmar reintento' : action === 'discard' ? 'Confirmar descarte y consultar' : 'Confirmar y enviar'}
      icon="checkmark" primary disabled={!consent || coordinator.busy} onPress={() => { void submit(); }} />
    {coordinator.busy && <ActivityIndicator accessibilityLabel="Enviando accion" color={colores.primario} />}
  </CoordinatorSheet>;
}
