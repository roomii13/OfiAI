/**
 * @archivo index.ts
 * @descripcion Integración con Resend para emails transaccionales de OfiAI.
 * Envía emails de bienvenida, propuestas, trabajos completados y alertas del sistema.
 * @modulo Integrations
 */

import { Resend } from 'resend';
import { env } from '../../config/env';

let resendClient: Resend | null = null;

export interface EnviarEmailResendParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Indica si Resend está configurado.
 */
export const resendDisponible = (): boolean => Boolean(env.RESEND_API_KEY);

/**
 * Obtiene el cliente singleton de Resend.
 */
const getResendClient = (): Resend => {
  if (!resendDisponible()) {
    throw new Error('Resend no está configurado. Define RESEND_API_KEY.');
  }

  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }

  return resendClient;
};

/**
 * Envía un email transaccional con Resend.
 */
export const enviarEmailResend = async (params: EnviarEmailResendParams): Promise<void> => {
  const resend = getResendClient();
  const resultado = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });

  if (resultado.error) {
    throw new Error(resultado.error.message);
  }
};
