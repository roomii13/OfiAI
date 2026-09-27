/** @archivo coordinatorPresentation.ts @descripcion Etiquetas del contrato Coordinator y fechas locales. */
import type { CoordinatorAction, CoordinatorState } from '../../../shared/coordinator';

export const coordinatorActions: Record<CoordinatorAction, string> = {
  contact: 'Contactar profesional', respond: 'Responder contacto', request_quote: 'Solicitar presupuesto',
  submit_quote: 'Enviar presupuesto', review_quote: 'Revisar presupuesto', counter_offer: 'Proponer contraoferta',
  accept_quote: 'Aceptar presupuesto', propose_schedule: 'Proponer agenda', confirm_schedule: 'Confirmar agenda',
  start_work: 'Iniciar trabajo', request_completion: 'Solicitar finalizacion', complete: 'Confirmar finalizacion', cancel: 'Cancelar coordinacion',
};
export const coordinatorStates: Record<CoordinatorState, string> = {
  MATCHED: 'Compatibilidad encontrada', PROFESSIONAL_SELECTED: 'Profesional seleccionado', CONTACT_PENDING: 'Contacto pendiente',
  CONTACTED: 'Contacto enviado', PROFESSIONAL_RESPONDED: 'Profesional respondio', QUOTE_REQUESTED: 'Presupuesto solicitado',
  QUOTE_RECEIVED: 'Presupuesto recibido', COMPANY_REVIEW: 'Revision de empresa', NEGOTIATION: 'Negociacion',
  SCHEDULE_PENDING: 'Agenda pendiente', SCHEDULED: 'Agenda propuesta', CONFIRMED: 'Acuerdo confirmado',
  IN_PROGRESS: 'En curso', COMPLETED: 'Completado', CANCELLED: 'Cancelado',
};
export const quoteUnits = { hour: 'Horas', m2: 'm2', unit: 'Unidades', job: 'Trabajo completo' };
export const quoteCoverage = { included: 'Incluidos', excluded: 'Excluidos', unknown: 'Por confirmar' };

/** Muestra el instante en la zona del dispositivo, incluyendo su identificador. */
export function coordinatorDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : date.toLocaleString('es-AR', { timeZoneName: 'short' });
}

/** Conserva moneda y valor declarados, sin conversion ni calculo de cobros. */
export function coordinatorMoney(amount: number, currency: string): string {
  return amount.toLocaleString('es-AR', { maximumFractionDigits: 2 }) + ' ' + currency;
}
