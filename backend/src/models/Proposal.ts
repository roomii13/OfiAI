/**
 * @archivo Proposal.ts
 * @descripcion Modelo de datos para propuestas de profesionales en OfiAI.
 * Una propuesta es la respuesta de un profesional a una solicitud de trabajo.
 * @modulo Modelos
 */
export type EstadoPropuesta = 'enviada' | 'vista' | 'aceptada' | 'rechazada' | 'retirada';

export interface Propuesta {
  /** Terminos comparables opcionales; los presupuestos legacy siguen siendo validos. */
  pricingTerms?: Pick<import('../../../shared/pricing').PricingQuote, 'scope' | 'unit' | 'quantity' | 'materials' | 'taxes' | 'validUntil'>;
  id: string;
  trabajoId: string;          // Referencia al trabajo
  profesionalId: string;      // Referencia al profesional
  empresaId: string;          // Referencia a la empresa (denormalizado para consultas)
  descripcion: string;        // Presentación del profesional para este trabajo
  precioOfertado: number;
  moneda: string;
  tiempoEstimado?: string;    // Ej: '3 días', '2 semanas'
  estado: EstadoPropuesta;
  generadaConIA: boolean;     // Si fue asistida por el agente de pricing
  fechaEnvio: Date;
  fechaVisto?: Date;
  fechaRespuesta?: Date;
  mensajes?: Array<{
    autorId: string;
    mensaje: string;
    fecha: Date;
  }>;
  adjuntos?: string[];
}
