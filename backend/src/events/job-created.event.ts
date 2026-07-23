/**
 * @archivo job-created.event.ts
 * @descripcion Evento disparado cuando una empresa publica un nuevo trabajo en OfiAI.
 * Desencadena el flujo de matching automático con IA.
 * @modulo Events
 */
export interface EventoTrabajoCreado {
  trabajoId: string;
  empresaId: string;
  categoria: string;
  ciudad: string;
  presupuesto?: { min?: number; max?: number; moneda: string };
  timestamp: Date;
}

/**
 * Publica el evento de trabajo creado.
 * TODO: Integrar con sistema de eventos (Pub/Sub de Google Cloud o EventEmitter)
 * TODO: Disparar matching.worker.ts automáticamente
 * TODO: Disparar pricing.worker.ts si no tiene presupuesto definido
 * TODO: Notificar a profesionales relevantes en la zona
 */
export const publicarEventoTrabajoCreado = async (_evento: EventoTrabajoCreado): Promise<void> => {
  // TODO: Implementar publicación del evento
};
