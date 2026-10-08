/**
 * @archivo Professional.ts
 * @descripcion Modelo de datos para profesionales de oficios en OfiAI.
 * Los profesionales son contratados por las empresas a través de la plataforma.
 * @modulo Modelos
 */
import { CodigoPais } from './User';

export interface Profesional {
  /** Suma acumulada para actualizar el promedio sin perdida de precision. */
  sumaCalificaciones?: number;
  /** Campos opcionales de matching; status solo puede administrarse desde backend. */
  status?: 'active' | 'inactive' | 'suspended';
  activo?: boolean;
  habilidades?: string[];
  provincia?: string;
  radioServicioKm?: number;
  precioMinimo?: number;
  tasaRespuesta?: number;
  id: string;
  usuarioId: string;          // Referencia al documento en colección 'users'
  nombre: string;
  apellido: string;
  especialidades: string[];   // Ej: ['plomería', 'gasfitería', 'soldadura']
  categorias: string[];       // Categorías principales del oficio
  descripcionPerfil?: string;
  fotoPerfil?: string;
  portafolio?: string[];      // URLs de imágenes de trabajos anteriores
  aniosExperiencia: number;
  tarifaHora?: number;        // En moneda local del país
  /** Cobertura declarada de la tarifa; su ausencia no se interpreta como exclusion. */
  tarifaHoraMateriales?: 'included' | 'excluded' | 'unknown';
  tarifaHoraImpuestos?: 'included' | 'excluded' | 'unknown';
  tarifaHoraActualizadaAt?: Date;
  tarifaServicio?: number;    // Tarifa por proyecto
  moneda: string;             // CLP, MXN, COP, ARS, PEN, etc.
  disponible: boolean;
  pais: CodigoPais;
  ciudad: string;
  zonaCobertura?: string[];   // Áreas geográficas donde trabaja
  coordenadas?: {
    latitud: number;
    longitud: number;
  };
  calificacionPromedio: number;
  totalResenas: number;
  totalTrabajos: number;
  verificado: boolean;        // Verificación manual del equipo OfiAI
  // Puntuación IA calculada por el agente de reputación
  puntajeReputacionIA?: number;
  fechaCreacion: Date;
  fechaActualizacion: Date;
  certificaciones?: string[];
  disponibilidadHoraria?: Array<{
    dia: string;
    desde: string;
    hasta: string;
  }>;
}
