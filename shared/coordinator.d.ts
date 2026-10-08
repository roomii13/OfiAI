/** @archivo coordinator.d.ts @descripcion Contrato de coordinacion compartido, sin secretos ni identidades privadas. */
import type { MatchingJob } from './matching';
import type { PricingQuote } from './pricing';
import type { ContractCharges } from './billing';
/** Estados persistentes del acuerdo bilateral. */
export type CoordinatorState = 'MATCHED' | 'PROFESSIONAL_SELECTED' | 'CONTACT_PENDING' | 'CONTACTED'
  | 'PROFESSIONAL_RESPONDED' | 'QUOTE_REQUESTED' | 'QUOTE_RECEIVED' | 'COMPANY_REVIEW' | 'NEGOTIATION'
  | 'SCHEDULE_PENDING' | 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
/** Participantes autorizados; un administrador no puede consentir por ellos. */
export type CoordinatorRole = 'empresa' | 'profesional';
/** Comandos, nunca estados arbitrarios enviados por el cliente. */
export type CoordinatorAction = 'contact' | 'respond' | 'request_quote' | 'submit_quote' | 'review_quote'
  | 'counter_offer' | 'accept_quote' | 'propose_schedule' | 'confirm_schedule' | 'start_work'
  | 'request_completion' | 'complete' | 'cancel';
/** Oferta propuesta por una parte y aceptada explicitamente por la otra. */
export interface CoordinatorOffer { quote: PricingQuote; proposedBy: CoordinatorRole; accepted: boolean }
/** Fechas ISO con zona horaria, mostradas en la zona local por los clientes. */
export interface CoordinatorSchedule { startsAt: string; endsAt: string; proposedBy: CoordinatorRole; confirmed: boolean }
/** Revision e idempotencia protegen doble clic, reintentos y pantallas antiguas. */
export interface CoordinatorCommand {
  workflowId: string; revision: number; idempotencyKey: string; action: CoordinatorAction;
  quote?: PricingQuote; schedule?: { startsAt: string; endsAt: string }; note?: string;
}
/** Inicio exige reconocer que una estimacion no es una oferta ni un cobro. */
export interface CoordinatorStart { idempotencyKey: string; acknowledgeEstimate: true }
/** Estado publico del workflow. */
export interface CoordinatorWorkflow {
  id: string; jobId: string; companyId: string; professionalId: string;
  professionalName: string; state: CoordinatorState; revision: number;
  matchingRunId: string; pricingEstimateId: string; pricingInsufficient: boolean;
  offer: CoordinatorOffer | null; schedule: CoordinatorSchedule | null;
  completionRequested: boolean; createdAt: string; updatedAt: string;
  /** Los acuerdos anteriores pueden carecer de desglose; no se les impone retroactivamente. */
  charges?: ContractCharges | null;
}
/** Auditoria bilateral: actor como rol, nunca tokens ni datos de contacto. */
export interface CoordinatorHistory { revision: number; action: string; from: CoordinatorState; to: CoordinatorState; actor: CoordinatorRole | 'system'; at: string; note: string | null }
/** Decision determinista del agente, recalculada desde el estado persistido. */
export interface CoordinatorAdvice { message: string; waitingFor: CoordinatorRole | null; actions: CoordinatorAction[] }
/** Detalle que comparten web y Expo. */
export interface CoordinatorView {
  job: MatchingJob; workflow: CoordinatorWorkflow | null; role: CoordinatorRole;
  advice: CoordinatorAdvice; history: CoordinatorHistory[];
}
/** Bandeja paginada por documento, sin consultas publicas a Firestore. */
export interface CoordinatorList { items: Array<{ jobId: string; title: string; state: CoordinatorState; updatedAt: string }>; nextCursor: string | null }
