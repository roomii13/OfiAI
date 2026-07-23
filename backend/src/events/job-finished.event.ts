/**
 * @archivo job-finished.event.ts
 * @descripcion Evento disparado cuando un trabajo es marcado como completado.
 * Desencadena el flujo de calificación y actualización de reputación.
 * @modulo Events
 */
export interface EventoTrabajoFinalizado {
  trabajoId: string;
  empresaId: string;
  profesionalId: string;
  timestamp: Date;
}

export const publicarEventoTrabajoFinalizado = async (_evento: EventoTrabajoFinalizado): Promise<void> => {
  // TODO: Solicitar reseña a la empresa
  // TODO: Solicitar reseña al profesional
  // TODO: Disparar reputation.worker.ts para actualizar puntaje
  // TODO: Actualizar estadísticas de ambas partes
  // TODO: Generar factura si corresponde
};
