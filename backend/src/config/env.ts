/**
 * @archivo env.ts
 * @descripcion Carga, valida y exporta las variables de entorno para OfiAI Backend.
 * Utiliza Zod para garantizar un esquema estricto de configuración en tiempo de ejecución.
 * @modulo Config
 */

import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Cargar variables de entorno desde el archivo .env si está disponible
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Esquema Zod para la validación estricta de variables de entorno.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default('8080'),
  API_VERSION: z.string().default('v1'),

  // Firebase
  FIREBASE_PROJECT_ID: z.string().default('ofiai-dev'),
  FIREBASE_PRIVATE_KEY: z
    .string()
    .transform((key) => key.replace(/\\n/g, '\n'))
    .default(''),
  FIREBASE_CLIENT_EMAIL: z.string().default(''),
  FIREBASE_STORAGE_BUCKET: z.string().default(''),

  // Google Gemini AI
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default('gemini-1.5-pro'),

  // Google Maps
  GOOGLE_MAPS_API_KEY: z.string().default(''),

  // Stripe
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),

  // Resend
  RESEND_API_KEY: z.string().default(''),
  RESEND_FROM_EMAIL: z.string().email().default('hola@ofiai.com'),

  // WhatsApp
  WHATSAPP_TOKEN: z.string().default(''),
  WHATSAPP_PHONE_ID: z.string().default(''),

  // Cache / Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  // Google Cloud Platform
  GCP_PROJECT_ID: z.string().default('ofiai-cloud'),
  GCP_REGION: z.string().default('us-central1'),

  // Seguridad
  JWT_SECRET: z.string().min(16, 'La clave JWT debe tener al menos 16 caracteres').default('ofiai-dev-jwt-secret-key-latam-2026'),
  CORS_ORIGINS: z
    .string()
    .transform((val) => val.split(',').map((origin) => origin.trim()))
    .default('http://localhost:5173'),
});

/**
 * Función interna para validar y extraer la configuración de entorno.
 * Lanza una excepción formateada en español si la validación falla.
 */
const parsearEnv = () => {
  const resultado = envSchema.safeParse(process.env);

  if (!resultado.success) {
    const errores = resultado.error.issues
      .map((issue) => `  - Variable [${issue.path.join('.')}]: ${issue.message}`)
      .join('\n');
    console.error('❌ Error crítico en la validación de variables de entorno:\n' + errores);
    throw new Error('Configuración de entorno inválida para OfiAI Backend.');
  }

  return resultado.data;
};

/**
 * Objeto de configuración de entorno validado y tipado.
 */
export const env = parsearEnv();

/**
 * Tipo inferido de la configuración de entorno.
 */
export type EnvConfig = typeof env;
