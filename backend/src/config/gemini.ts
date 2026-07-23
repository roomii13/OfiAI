/**
 * @archivo gemini.ts
 * @descripcion Configuración e integración centralizada del SDK de Google Gemini AI para OfiAI.
 * Proporciona acceso a modelos generativos, configuraciones de seguridad por defecto y verificación de estado.
 * @modulo Config
 */

import {
  GoogleGenerativeAI,
  GenerativeModel,
  HarmCategory,
  HarmBlockThreshold,
  GenerationConfig,
  SafetySetting,
} from '@google/generative-ai';
import { env } from './env';
import { logger } from './logger';

let clienteGemini: GoogleGenerativeAI | null = null;

/**
 * Configuraciones de seguridad por defecto para los agentes e interacciones con Gemini AI.
 */
export const configuracionSeguridadGemini: SafetySetting[] = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

/**
 * Parámetros de generación por defecto ajustados para agentes analíticos y de matching.
 */
export const configuracionGeneracionDefecto: GenerationConfig = {
  temperature: 0.2,
  topP: 0.8,
  topK: 40,
  maxOutputTokens: 2048,
};

/**
 * Obtiene la instancia del cliente principal de Google Generative AI (Singleton).
 * @returns Instancia de GoogleGenerativeAI.
 */
export const getGeminiClient = (): GoogleGenerativeAI => {
  if (!clienteGemini) {
    if (!env.GEMINI_API_KEY) {
      logger.warn('⚠️ Se requiere GEMINI_API_KEY para interacciones con modelos generativos.');
    }
    clienteGemini = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  }
  return clienteGemini;
};

/**
 * Obtiene un modelo generativo configurado listo para inferencias.
 * @param nombreModelo - Nombre opcional del modelo (por defecto utiliza env.GEMINI_MODEL).
 * @param configGeneracion - Ajustes opcionales de generación.
 * @returns Instancia de GenerativeModel.
 */
export const getGeminiModel = (
  nombreModelo?: string,
  configGeneracion?: Partial<GenerationConfig>
): GenerativeModel => {
  const cliente = getGeminiClient();
  const modelo = nombreModelo || env.GEMINI_MODEL;

  return cliente.getGenerativeModel({
    model: modelo,
    safetySettings: configuracionSeguridadGemini,
    generationConfig: {
      ...configuracionGeneracionDefecto,
      ...configGeneracion,
    },
  });
};

/**
 * Realiza una prueba de salud básica contra la API de Gemini para validar la disponibilidad del servicio.
 * @returns Promesa que resuelve en true si la API responde correctamente.
 */
export const verificarConexionGemini = async (): Promise<boolean> => {
  try {
    const model = getGeminiModel();
    const result = await model.generateContent('ping');
    const response = await result.response;
    const text = response.text();
    return Boolean(text && text.length > 0);
  } catch (error) {
    logger.error('❌ Falló la verificación de conexión con la API de Google Gemini:', { error });
    return false;
  }
};
