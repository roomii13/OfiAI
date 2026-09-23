/**
 * @archivo notification.validator.ts
 * @descripcion Esquemas de validación HTTP para el módulo de notificaciones de OfiAI.
 * Valida creación multicanal, lectura y ejecución de reintentos.
 * @modulo Validators
 */

import { z } from 'zod';

export const esquemaCanalNotificacion = z.enum(['push', 'email', 'whatsapp', 'in_app']);
export const esquemaTipoNotificacion = z.enum([
  'nueva_propuesta',
  'propuesta_aceptada',
  'propuesta_rechazada',
  'trabajo_publicado',
  'trabajo_completado',
  'nueva_resena',
  'suscripcion_vencida',
  'recomendacion_ia',
  'alerta_sistema',
]);

export const esquemaCrearNotificacion = z.object({
  usuarioId: z.string().trim().min(1).optional(),
  tipo: esquemaTipoNotificacion,
  canales: z.array(esquemaCanalNotificacion).min(1).max(4),
  titulo: z.string().trim().min(3).max(120).optional(),
  mensaje: z.string().trim().min(3).max(800).optional(),
  datos: z.record(z.union([z.string(), z.number(), z.boolean(), z.undefined()])).optional(),
  destinatario: z.object({
    email: z.string().email().optional(),
    telefono: z.string().trim().min(8).max(20).optional(),
    pushToken: z.string().trim().min(10).optional(),
  }).optional(),
  programadaPara: z.string().datetime().transform((valor) => new Date(valor)).optional(),
});

export const esquemaProcesarReintentos = z.object({
  limite: z.number().int().min(1).max(200).optional(),
});

export type DatosCrearNotificacion = z.infer<typeof esquemaCrearNotificacion>;
export type DatosProcesarReintentos = z.infer<typeof esquemaProcesarReintentos>;
