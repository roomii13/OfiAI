/**
 * @archivo Company.ts
 * @descripcion Modelo de datos para la entidad Empresa en OfiAI.
 * Las empresas son las entidades contratantes dentro de la plataforma SaaS.
 * @modulo Modelos
 */
import { CodigoPais } from './User';

export interface Empresa {
  id: string;
  usuarioId: string;          // Referencia al documento de usuario en la colección 'users'
  /** Distingue organizaciones de personas sin cambiar ownership de trabajos existentes. */
  tipoCuenta?: 'empresa' | 'particular';
  nombreEmpresa: string;
  rut?: string;               // RUT/RFC/NIT/RUC según el país de Latinoamérica
  industria: string;
  tamanoEmpresa: 'micro' | 'pequena' | 'mediana' | 'grande';
  descripcion?: string;
  sitioWeb?: string;
  logoUrl?: string;
  pais: CodigoPais;
  ciudad: string;
  direccion?: string;
  coordenadas?: {             // Para matching y geolocalización por proximidad
    latitud: number;
    longitud: number;
  };
  suscripcionActiva: boolean;
  planSuscripcion?: 'basico' | 'pro' | 'enterprise';
  totalContrataciones: number;
  calificacionPromedio: number;
  activo: boolean;             // Control de Soft Delete
  fechaCreacion: Date;
  fechaActualizacion: Date;
}

export type CompanyModel = Empresa;
