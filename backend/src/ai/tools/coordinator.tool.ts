/** @archivo coordinator.tool.ts @descripcion Maquina de estados pura: el servidor es la autoridad del consentimiento. */
import type { CoordinatorWorkflow, CoordinatorRole, CoordinatorAdvice, CoordinatorCommand, CoordinatorState } from '../../../../shared/coordinator';
import { ApiError } from '../../middleware/error.middleware';
/** Determina acciones autorizadas desde el acuerdo actual, no desde sugerencias de un LLM. */
export function coordinatorAdvice(w: CoordinatorWorkflow, role: CoordinatorRole, now = Date.now()): CoordinatorAdvice {
  let waitingFor: CoordinatorRole | null = null;
  let actions: CoordinatorAdvice['actions'] = [];
  let message = 'La coordinacion esta cerrada.';
  switch (w.state) {
    case 'MATCHED': case 'PROFESSIONAL_SELECTED':
      waitingFor = 'empresa'; actions = ['contact']; message = 'Confirma el envio de una invitacion interna al profesional seleccionado.'; break;
    case 'CONTACT_PENDING':
      message = 'Estamos entregando la invitacion en la bandeja interna. Todavia no fue confirmada su lectura.'; break;
    case 'CONTACTED':
      waitingFor = 'profesional'; actions = ['respond']; message = 'La invitacion esta disponible en OfiAI. Falta la respuesta del profesional.'; break;
    case 'PROFESSIONAL_RESPONDED':
      waitingFor = 'empresa'; actions = ['request_quote']; message = 'El profesional acepto conversar. Solicita un presupuesto con alcance y cobertura.'; break;
    case 'QUOTE_REQUESTED':
      waitingFor = 'profesional'; actions = ['submit_quote']; message = 'El profesional debe enviar su presupuesto. Una estimacion de IA no lo reemplaza.'; break;
    case 'QUOTE_RECEIVED':
      waitingFor = 'empresa'; actions = ['review_quote']; message = 'Hay un presupuesto nuevo para revisar.'; break;
    case 'COMPANY_REVIEW': case 'NEGOTIATION':
      waitingFor = w.offer?.proposedBy === 'empresa' ? 'profesional' : 'empresa';
      actions = ['counter_offer'];
      if (w.offer && Date.parse(w.offer.quote.validUntil + 'T23:59:59.999Z') >= now) actions.unshift('accept_quote');
      message = 'Revisa importe, moneda, alcance, materiales e impuestos antes de aceptar o proponer cambios.'; break;
    case 'SCHEDULE_PENDING':
      actions = ['propose_schedule']; message = 'El presupuesto fue aceptado. Propongan fecha y horario de realizacion.'; break;
    case 'SCHEDULED':
      waitingFor = w.schedule?.proposedBy === 'empresa' ? 'profesional' : 'empresa';
      actions = ['propose_schedule'];
      if (w.schedule && Date.parse(w.schedule.startsAt) > now) actions.unshift('confirm_schedule');
      message = 'La otra parte debe confirmar el horario; puede proponer uno distinto.'; break;
    case 'CONFIRMED':
      waitingFor = 'profesional'; actions = w.schedule && Date.parse(w.schedule.startsAt) <= now ? ['start_work'] : [];
      message = 'Ambas partes acordaron presupuesto y horario. El profesional puede iniciar desde la fecha acordada.'; break;
    case 'IN_PROGRESS':
      waitingFor = w.completionRequested ? 'empresa' : 'profesional';
      actions = w.completionRequested ? ['complete'] : ['request_completion'];
      message = w.completionRequested ? 'El profesional informo la finalizacion. La empresa debe verificar el trabajo y confirmar el cierre.' : 'El trabajo esta en curso. El profesional puede informar que termino.'; break;
  }
  if (waitingFor && waitingFor !== role) actions = [];
  if (!['IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(w.state)) actions.push('cancel');
  return { actions, waitingFor, message };
}
/** Aplica un unico comando validado y conserva el resto del acuerdo. No produce efectos externos. */
export function transitionCoordinator(w: CoordinatorWorkflow, role: CoordinatorRole, c: CoordinatorCommand, now = Date.now()): CoordinatorWorkflow {
  if (w.id !== c.workflowId) throw new ApiError('Esta accion pertenece a otra coordinacion.', 409);
  if (w.revision !== c.revision) throw new ApiError('La coordinacion cambio. Actualiza antes de continuar.', 409);
  if (!coordinatorAdvice(w, role, now).actions.includes(c.action)) throw new ApiError('Esta accion no corresponde a tu rol o al estado actual.', 409);
  const next = structuredClone(w);
  const targets: Partial<Record<CoordinatorCommand['action'], CoordinatorState>> = {
    contact: 'CONTACT_PENDING', respond: 'PROFESSIONAL_RESPONDED', request_quote: 'QUOTE_REQUESTED',
    submit_quote: 'QUOTE_RECEIVED', review_quote: 'COMPANY_REVIEW', counter_offer: 'NEGOTIATION',
    accept_quote: 'SCHEDULE_PENDING', propose_schedule: 'SCHEDULED', confirm_schedule: 'CONFIRMED',
    start_work: 'IN_PROGRESS', complete: 'COMPLETED', cancel: 'CANCELLED',
  };
  next.state = targets[c.action] ?? w.state;
  if (c.quote) {
    const expiry = Date.parse(c.quote.validUntil + 'T23:59:59.999Z');
    if (expiry < now || expiry > now + 367 * 86400000) throw new ApiError('Revisa la vigencia del presupuesto.', 400);
    if (c.quote.materials === 'unknown' || c.quote.taxes === 'unknown') throw new ApiError('Confirma si materiales e impuestos estan incluidos o excluidos.', 400);
    next.offer = { quote: c.quote, proposedBy: role, accepted: false };
  }
  if (c.action === 'accept_quote' && next.offer) next.offer.accepted = true;
  if (c.schedule) {
    const start = Date.parse(c.schedule.startsAt), end = Date.parse(c.schedule.endsAt);
    if (start <= now || end <= start || start > now + 366 * 86400000 || end - start > 90 * 86400000)
      throw new ApiError('El horario debe ser futuro y el fin posterior al inicio, con hasta 90 dias de duracion.', 400);
    next.schedule = { startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), proposedBy: role, confirmed: false };
  }
  if (c.action === 'confirm_schedule' && next.schedule) next.schedule.confirmed = true;
  if (c.action === 'request_completion') next.completionRequested = true;
  next.revision += 1; next.updatedAt = new Date(now).toISOString();
  return next;
}
