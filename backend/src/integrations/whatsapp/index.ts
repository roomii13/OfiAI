/**
 * @archivo index.ts
 * @descripcion Integración con WhatsApp Business API para notificaciones de OfiAI.
 * Envía alertas de nuevos trabajos, propuestas y actualizaciones usando la API Graph de Meta.
 * @modulo Integrations
 */

import { env } from '../../config/env';

export interface EnviarMensajeWhatsAppParams {
  to: string;
  message: string;
}

interface WhatsAppErrorResponse {
  error?: {
    message?: string;
  };
}

/**
 * Indica si WhatsApp Business está configurado.
 */
export const whatsappDisponible = (): boolean => Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID);

/**
 * Envía un mensaje de texto por WhatsApp Business.
 */
export const enviarMensajeWhatsApp = async (params: EnviarMensajeWhatsAppParams): Promise<void> => {
  if (!whatsappDisponible()) {
    throw new Error('WhatsApp no está configurado. Define WHATSAPP_TOKEN y WHATSAPP_PHONE_ID.');
  }

  const response = await fetch(`https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: params.to,
      type: 'text',
      text: {
        preview_url: false,
        body: params.message,
      },
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as WhatsAppErrorResponse;
    throw new Error(data.error?.message ?? `WhatsApp respondió ${response.status}.`);
  }
};
