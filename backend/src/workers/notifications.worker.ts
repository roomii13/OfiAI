/**
 * @archivo notifications.worker.ts
 * @descripcion Worker de envío de notificaciones multicanal para OfiAI.
 * Distribuye notificaciones a través de email (Resend), push, SMS y WhatsApp.
 * @modulo Workers
 */
import { notificationService } from '../services/notification.service';

/**
 * Ejecuta el envío de una notificación pendiente por ID.
 */
export const notificationsWorker = async (notificacionId: string): Promise<void> => {
  await notificationService.enviarNotificacion(notificacionId);
};

/**
 * Ejecuta el procesamiento batch de reintentos de notificación.
 */
export const notificationRetriesWorker = async (limite = 50): Promise<{ procesadas: number }> => {
  return notificationService.procesarReintentos(limite);
};
