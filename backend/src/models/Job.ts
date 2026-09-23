/**
 * @archivo Job.ts
 * @descripcion Modelo de datos para trabajos/solicitudes de servicio en OfiAI.
 * Representa una solicitud publicada por una empresa buscando un profesional.
 * @modulo Modelos
 */
export type EstadoTrabajo = 'borrador' | 'publicado' | 'en_revision' | 'en_progreso' | 'completado' | 'cancelado';

export interface Trabajo {
  matchingStatus?: import('../../../shared/matching').MatchingStatus;
  matchingSelection?: import('../../../shared/matching').MatchingSelection | null;
  source?: 'manual' | 'ai_intake';
  aiIntakeSessionId?: string;
  companyId?: string;
  title?: string;
  description?: string;
  category?: string;
  location?: { country: string | null; city: string | null; region: string | null; latitude?: number; longitude?: number };
  urgency?: 'low' | 'normal' | 'high' | 'emergency' | null;
  budget?: { min: number | null; max: number | null; currency: string | null };
  preferredDate?: string | null;
  requirements?: string[];
  estimatedScope?: string | null;
  attachmentsRequired?: boolean | null;
  attachmentReason?: string | null;
  multipleProfessionals?: boolean | null;
  professionalTypes?: string[];
  status?: EstadoTrabajo;
  createdAt?: Date;
  updatedAt?: Date;
  id: string;
  empresaId: string;          // Referencia a la empresa que publica
  titulo: string;
  descripcion: string;
  categoria: string;
  subcategoria?: string;
  habilidadesRequeridas: string[];
  presupuestoMinimo?: number;
  presupuestoMaximo?: number;
  moneda: string;
  tipoTrabajo: 'presencial' | 'remoto' | 'hibrido';
  ciudad?: string;
  direccion?: string;
  coordenadas?: {
    latitud: number;
    longitud: number;
  };
  fechaInicio?: Date;
  fechaFin?: Date;
  estado: EstadoTrabajo;
  profesionalAsignadoId?: string;
  propuestasRecibidas: number;
  // Datos generados por IA
  puntajeMatchingIA?: number;
  profesionalesRecomendados?: string[]; // IDs generados por el agente de matching
  presupuestoSugeridoIA?: number;       // Precio estimado por el agente de pricing
  fechaCreacion: Date;
  fechaActualizacion: Date;
  adjuntos?: string[];
  historialEstados?: Array<{
    estado: EstadoTrabajo;
    fecha: Date;
    usuarioId: string;
    comentario?: string;
  }>;
}
