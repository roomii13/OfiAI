/**
 * @archivo intake.event.ts
 * @descripcion Eventos minimos de Intake, sin mensajes ni datos personales.
 */
import type { IntakeSession } from '../models/intake.model';
export type IntakeEventType = 'intake_started' | 'intake_message_sent' | 'intake_completed' | 'intake_abandoned' | 'job_created_from_ai';

/** Construye metadatos agregables sin copiar la conversacion a analytics. */
export function intakeEvent(type: IntakeEventType, session: IntakeSession) {
  return {
    tipo: type, entidadId: session.id, entidadTipo: 'ai_intake_session',
    fechaCreacion: new Date(), metadata: {
      intake_duration: Math.max(0, Date.now() - Date.parse(session.createdAt)),
      number_of_messages: session.messages.filter(message => message.role === 'user').length,
      missing_information_count: session.missingInformation.length,
      schemaVersion: session.schemaVersion,
    },
  };
}
