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
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

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
  FIREBASE_API_KEY: z.string().default(''),
  FIREBASE_PROJECT_ID: z.string().default('ofiai-dev'),
  FIREBASE_DATABASE_ID: z.string().trim().min(1).default('(default)'),
  FIREBASE_PRIVATE_KEY: z
    .string()
    .transform((key) => key.replace(/\\n/g, '\n'))
    .default(''),
  FIREBASE_CLIENT_EMAIL: z.string().default(''),
  FIREBASE_STORAGE_BUCKET: z.string().default(''),

  // Google Gemini AI
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default('gemini-1.5-pro'),
  GEMINI_INTAKE_MODEL: z.string().regex(/^[a-zA-Z0-9._-]+$/).default('gemini-3.6-flash'),
  GEMINI_INTAKE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(30000),
  GEMINI_MATCHING_MODEL: z.string().regex(/^[a-zA-Z0-9._-]+$/).default('gemini-3.6-flash'),
  GEMINI_MATCHING_ENABLED: z.string().default('true').transform(value => value === 'true'),
  MATCHING_CACHE_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(1800),

  // Google Maps
  GEMINI_PRICING_MODEL: z.string().regex(/^[a-zA-Z0-9._-]+$/).default('gemini-3.6-flash'),
  GEMINI_PRICING_ENABLED: z.string().default('true').transform(value => value === 'true'),

  GOOGLE_MAPS_API_KEY: z.string().default(''),

  // Mercado Pago
  MERCADOPAGO_ACCESS_TOKEN: z.string().default(''),
  MERCADOPAGO_WEBHOOK_SECRET: z.string().default(''),
  MERCADOPAGO_CURRENCY: z.string().default('ARS'),
  MERCADOPAGO_NOTIFICATION_URL: z.string().url().optional(),

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

  // Scheduler
  SCHEDULER_ENABLED: z
    .string()
    .transform((val) => val !== 'false')
    .default('true'),

  // Google Cloud Platform
  GCP_PROJECT_ID: z.string().default('ofiai-cloud'),
  GCP_REGION: z.string().default('us-central1'),

  // Seguridad
  JWT_SECRET: z.string().min(16, 'La clave JWT debe tener al menos 16 caracteres').default('ofiai-dev-jwt-secret-key-latam-2026'),
  CORS_ORIGINS: z
    .string()
    .transform((val) => val.split(',').map((origin) => origin.trim()))
    .default('http://localhost:5173'),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV !== 'production') {
    return;
  }

  const requerir = (campo: keyof typeof env, mensaje?: string): void => {
    const valor = env[campo];
    if (typeof valor !== 'string' || valor.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [campo],
        message: mensaje ?? 'Variable obligatoria en producción.',
      });
    }
  };

  [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_API_KEY',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_STORAGE_BUCKET',
    'GEMINI_API_KEY',
    'GOOGLE_MAPS_API_KEY',
    'MERCADOPAGO_ACCESS_TOKEN',
    'MERCADOPAGO_WEBHOOK_SECRET',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
    'WHATSAPP_TOKEN',
    'WHATSAPP_PHONE_ID',
    'JWT_SECRET',
  ].forEach((campo) => requerir(campo as keyof typeof env));

  if (!env.MERCADOPAGO_NOTIFICATION_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['MERCADOPAGO_NOTIFICATION_URL'],
      message: 'La URL pública del webhook de Mercado Pago es obligatoria en producción.',
    });
  }

  if (env.FIREBASE_PROJECT_ID === 'ofiai-dev') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['FIREBASE_PROJECT_ID'],
      message: 'No uses el project ID de desarrollo en producción.',
    });
  }

  if (env.JWT_SECRET === 'ofiai-dev-jwt-secret-key-latam-2026' || env.JWT_SECRET.length < 32) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['JWT_SECRET'],
      message: 'JWT_SECRET debe ser único para producción y tener al menos 32 caracteres.',
    });
  }

  if (env.MERCADOPAGO_ACCESS_TOKEN.startsWith('TEST-')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['MERCADOPAGO_ACCESS_TOKEN'],
      message: 'Usa un access token productivo de Mercado Pago, no uno de sandbox.',
    });
  }

  if (env.CORS_ORIGINS.includes('*') || env.CORS_ORIGINS.some((origin) => origin.includes('localhost'))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CORS_ORIGINS'],
      message: 'CORS_ORIGINS debe contener dominios HTTPS reales en producción.',
    });
  }
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
