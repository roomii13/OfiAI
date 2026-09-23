/**
 * @archivo Review.ts
 * @descripcion Modelo de datos para reseñas y calificaciones en OfiAI.
 * Las reseñas son bidireccionales: empresa califica profesional y viceversa.
 * @modulo Modelos
 */
export interface Resena {
  id: string;
  trabajoId: string;
  autorId: string;            // Quien escribe la reseña
  destinatarioId: string;     // Quien recibe la reseña
  tipoResena: 'empresa_a_profesional' | 'profesional_a_empresa';
  calificacion: number;       // 1 a 5 estrellas
  comentario: string;
  calificacionesDetalladas?: {
    puntualidad?: number;
    calidadTrabajo?: number;
    comunicacion?: number;
    limpieza?: number;
    precio?: number;
  };
  visible: boolean;
  // Análisis de sentimiento generado por IA
  sentimientoIA?: 'positivo' | 'neutro' | 'negativo';
  fechaCreacion: Date;
  respuesta?: {
    autorId: string;
    comentario: string;
    fecha: Date;
  };
  moderacionIA?: {
    estado: 'aprobada' | 'requiere_revision' | 'rechazada';
    razon?: string;
    confianza: number;
  };
}
