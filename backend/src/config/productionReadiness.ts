/**
 * @archivo productionReadiness.ts
 * @descripcion Verificación de preparación productiva basada en configuración no sensible.
 * Permite diagnosticar servicios externos sin exponer credenciales.
 * @modulo Config
 */
import { env } from './env';

export type EstadoReadinessServicio = 'operacional' | 'degradado' | 'caido';

export interface ReadinessServicio {
  nombre: string;
  estado: EstadoReadinessServicio;
  mensaje: string;
}

export interface ReadinessProduccion {
  estado: 'saludable' | 'degradado' | 'critico';
  servicios: ReadinessServicio[];
}

/**
 * Construye un estado seguro para un servicio según presencia de configuración.
 */
function servicioConfigurado(nombre: string, configurado: boolean, mensajeOk: string, mensajeFalla: string): ReadinessServicio {
  return {
    nombre,
    estado: configurado ? 'operacional' : 'degradado',
    mensaje: configurado ? mensajeOk : mensajeFalla,
  };
}

/**
 * Evalúa la configuración productiva sin llamar a proveedores externos.
 */
export function obtenerReadinessProduccion(): ReadinessProduccion {
  const servicios: ReadinessServicio[] = [
    servicioConfigurado(
      'firebase_admin',
      Boolean(env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY),
      'Credenciales Firebase Admin configuradas.',
      'Faltan credenciales Firebase Admin.'
    ),
    servicioConfigurado(
      'firebase_storage',
      Boolean(env.FIREBASE_STORAGE_BUCKET),
      'Bucket de Firebase Storage configurado.',
      'Falta FIREBASE_STORAGE_BUCKET.'
    ),
    servicioConfigurado(
      'mercado_pago',
      Boolean(env.MERCADOPAGO_ACCESS_TOKEN && env.MERCADOPAGO_WEBHOOK_SECRET && env.MERCADOPAGO_NOTIFICATION_URL),
      'Mercado Pago configurado para checkout y webhooks.',
      'Faltan credenciales o URL de webhook de Mercado Pago.'
    ),
    servicioConfigurado(
      'resend',
      Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL),
      'Resend configurado para email.',
      'Faltan credenciales Resend.'
    ),
    servicioConfigurado(
      'whatsapp',
      Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID),
      'WhatsApp configurado.',
      'Faltan credenciales WhatsApp.'
    ),
    servicioConfigurado(
      'gemini',
      Boolean(env.GEMINI_API_KEY),
      'Gemini configurado.',
      'Falta GEMINI_API_KEY.'
    ),
    servicioConfigurado(
      'google_maps',
      Boolean(env.GOOGLE_MAPS_API_KEY),
      'Google Maps configurado.',
      'Falta GOOGLE_MAPS_API_KEY.'
    ),
  ];

  const fallas = servicios.filter((servicio) => servicio.estado !== 'operacional').length;

  return {
    estado: fallas === 0 ? 'saludable' : fallas >= 3 ? 'critico' : 'degradado',
    servicios,
  };
}
