/** @archivo coordinatorPresentation.ts @descripcion Etiquetas y consentimientos del acuerdo bilateral. */
import { Bell, MessageSquare, FileText, Eye, Handshake, CalendarPlus, CalendarCheck, Play, CheckCheck, Check, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CoordinatorAction, CoordinatorState } from '../../../shared/coordinator';

export const coordinatorStates: Record<CoordinatorState, string> = {
  MATCHED: 'Compatibilidad encontrada', PROFESSIONAL_SELECTED: 'Profesional seleccionado',
  CONTACT_PENDING: 'Contacto pendiente', CONTACTED: 'Notificacion interna enviada',
  PROFESSIONAL_RESPONDED: 'Profesional respondio', QUOTE_REQUESTED: 'Presupuesto solicitado',
  QUOTE_RECEIVED: 'Presupuesto recibido', COMPANY_REVIEW: 'En revision por empresa',
  NEGOTIATION: 'En negociacion', SCHEDULE_PENDING: 'Fecha pendiente', SCHEDULED: 'Fecha propuesta',
  CONFIRMED: 'Fecha confirmada', IN_PROGRESS: 'Trabajo en curso', COMPLETED: 'Trabajo completado', CANCELLED: 'Coordinacion cancelada',
};

export const coordinatorActions: Record<CoordinatorAction, { label: string; consent: string; icon: LucideIcon }> = {
  contact: { label: 'Notificar al profesional', consent: 'Se enviara solo una notificacion interna de OfiAI. No se enviaran emails ni WhatsApp. No implica contratacion ni cobro.', icon: Bell },
  respond: { label: 'Responder a la empresa', consent: 'Confirmo mi respuesta a esta coordinacion. No estoy aceptando una oferta ni una fecha.', icon: MessageSquare },
  request_quote: { label: 'Solicitar presupuesto', consent: 'Solicito un presupuesto al profesional. La estimacion orientativa no es una oferta ni autoriza cobros.', icon: FileText },
  submit_quote: { label: 'Enviar presupuesto', consent: 'Propongo este presupuesto completo a la empresa. Quedara pendiente de aceptacion de la otra parte.', icon: FileText },
  review_quote: { label: 'Marcar presupuesto en revision', consent: 'Revisare el presupuesto recibido. Esta accion no acepta la oferta.', icon: Eye },
  counter_offer: { label: 'Enviar contraoferta', consent: 'Propongo estas nuevas condiciones completas. Requieren aceptacion explicita de la otra parte.', icon: FileText },
  accept_quote: { label: 'Aceptar oferta vigente', consent: 'Acepto el importe, moneda, alcance y condiciones de la oferta vigente mostrada. Esta accion no realiza ningun cobro.', icon: Handshake },
  propose_schedule: { label: 'Proponer fecha y horario', consent: 'Propongo este inicio y fin en mi zona horaria local. La otra parte debe confirmar la fecha.', icon: CalendarPlus },
  confirm_schedule: { label: 'Confirmar fecha propuesta', consent: 'Acepto las fechas de inicio y fin propuestas. Con el presupuesto ya aceptado, este acuerdo bilateral asigna el trabajo al profesional. No inicia el trabajo ni realiza cobros.', icon: CalendarCheck },
  start_work: { label: 'Confirmar inicio del trabajo', consent: 'Como profesional, confirmo que el trabajo comienza ahora, desde la fecha de inicio acordada.', icon: Play },
  request_completion: { label: 'Solicitar confirmacion de finalizacion', consent: 'Informo que termine el trabajo y solicito a la empresa que confirme su finalizacion. El trabajo aun no se marca completado.', icon: CheckCheck },
  complete: { label: 'Confirmar trabajo completado', consent: 'Como empresa, confirmo la finalizacion solicitada por el profesional. Esta accion no realiza cobros.', icon: Check },
  cancel: { label: 'Cancelar coordinacion', consent: 'Confirmo la cancelacion de esta coordinacion. No implica reembolsos ni movimientos de dinero.', icon: X },
};

/** Fechas de agenda e historial en la zona local, con zona visible. */
export function coordinatorDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : date.toLocaleString('es-AR', {
    dateStyle: 'medium', timeStyle: 'short',
  }) + ' (' + Intl.DateTimeFormat().resolvedOptions().timeZone + ')';
}

/** Conserva la fecha civil de vigencia sin desplazarla por UTC. */
export function quoteDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? day + '/' + month + '/' + year : value;
}
