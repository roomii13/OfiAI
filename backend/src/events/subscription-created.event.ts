/**
 * @archivo subscription-created.event.ts
 * @descripcion Evento disparado cuando se activa una nueva suscripción en OfiAI.
 * @modulo Events
 */
export interface EventoSuscripcionCreada {
  suscripcionId: string;
  usuarioId: string;
  plan: 'basico' | 'pro' | 'enterprise';
  monto: number;
  moneda: string;
  timestamp: Date;
}

export const publicarEventoSuscripcionCreada = async (_evento: EventoSuscripcionCreada): Promise<void> => {
  // TODO: Enviar email de confirmación de pago via Resend
  // TODO: Actualizar límites del usuario en Firestore
  // TODO: Registrar revenue en analytics
  // TODO: Notificar al equipo de ventas (si es Enterprise)
};
