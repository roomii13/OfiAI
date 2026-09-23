/**
 * @archivo Notification.ts
 * @descripcion Modelo de datos para notificaciones en OfiAI.
 * Centraliza todas las notificaciones del sistema independientemente del canal.
 * @modulo Modelos
 */
export type TipoNotificacion =
  | 'nueva_propuesta'
  | 'propuesta_aceptada'
  | 'propuesta_rechazada'
  | 'trabajo_publicado'
  | 'trabajo_completado'
  | 'nueva_resena'
  | 'suscripcion_vencida'
  | 'recomendacion_ia'
  | 'alerta_sistema';

export type CanalNotificacion = 'push' | 'email' | 'sms' | 'whatsapp' | 'in_app';
export type EstadoNotificacion = 'pendiente' | 'enviada' | 'reintentando' | 'fallida';

export interface Notificacion {
  id: string;
  usuarioId: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  canal: CanalNotificacion;
  estado: EstadoNotificacion;
  leida: boolean;
  enviada: boolean;
  intentos: number;
  maxIntentos: number;
  datos?: Record<string, unknown>;
  destinatario?: {
    email?: string;
    telefono?: string;
    pushToken?: string;
  };
  fechaCreacion: Date;
  fechaLeida?: Date;
  fechaEnvio?: Date;
  programadaPara?: Date;
  proximoIntento?: Date;
  errorEnvio?: string;
}
