/**
 * @archivo Job.ts
 * @descripcion Modelo de datos para trabajos/solicitudes de servicio en OfiAI.
 * Representa una solicitud publicada por una empresa buscando un profesional.
 * @modulo Modelos
 */
export type EstadoTrabajo = 'borrador' | 'publicado' | 'en_revision' | 'en_progreso' | 'completado' | 'cancelado';

export interface Trabajo {
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
  // TODO: Agregar sistema de adjuntos (imágenes del lugar, planos, etc.)
  // TODO: Agregar historial de cambios de estado
}
