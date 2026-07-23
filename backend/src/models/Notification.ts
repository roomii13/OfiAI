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

export interface Notificacion {
  id: string;
  usuarioId: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  canal: CanalNotificacion;
  leida: boolean;
  enviada: boolean;
  datos?: Record<string, unknown>;  // Datos adicionales según el tipo
  fechaCreacion: Date;
  fechaLeida?: Date;
  fechaEnvio?: Date;
  // TODO: Agregar soporte para notificaciones programadas
  // TODO: Agregar preferencias de notificación por usuario
}
