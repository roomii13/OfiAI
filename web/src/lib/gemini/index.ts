/**
 * @archivo lib/gemini/index.ts
 * @descripcion Cliente de Gemini AI para el frontend de OfiAI.
 * Expone helpers que consumen el módulo de IA del backend sin filtrar claves al navegador.
 * @modulo Lib
 */
import { api } from '../api/client';

/**
 * Mensaje de chat enviado al asistente IA de OfiAI.
 */
export interface ChatIaRequest {
  mensaje: string;
  contexto?: Record<string, unknown>;
}

/**
 * Respuesta de chat producida por el backend de IA.
 */
export interface ChatIaResponse {
  respuesta: string;
  origen: 'reglas' | 'gemini';
  accionesSugeridas?: string[];
}

/**
 * Solicitud de clasificación automática para trabajos o mensajes entrantes.
 */
export interface ClasificacionIaRequest {
  titulo?: string;
  descripcion: string;
  categoriaSugerida?: string;
}

/**
 * Resultado de clasificación devuelto por el backend.
 */
export interface ClasificacionIaResponse {
  categoria: string;
  prioridad: 'baja' | 'media' | 'alta';
  etiquetas: string[];
  confianza: number;
}

interface ApiEnvelope<T> {
  exito: boolean;
  datos?: T;
  mensaje?: string;
}

/**
 * Valida y extrae datos de respuestas estándar de la API.
 */
function unwrap<T>(response: ApiEnvelope<T>): T {
  if (!response.exito || !response.datos) {
    throw new Error(response.mensaje ?? 'La IA no devolvió datos válidos.');
  }

  return response.datos;
}

/**
 * Envía un mensaje al asistente IA a través del backend.
 */
export async function enviarMensajeIa(request: ChatIaRequest, token?: string): Promise<ChatIaResponse> {
  const response = await api.post<ApiEnvelope<ChatIaResponse>>('/ai/chat', request, token);
  return unwrap(response);
}

/**
 * Clasifica una solicitud usando las reglas del backend y Gemini cuando esté habilitado.
 */
export async function clasificarSolicitudIa(
  request: ClasificacionIaRequest,
  token?: string
): Promise<ClasificacionIaResponse> {
  const response = await api.post<ApiEnvelope<ClasificacionIaResponse>>('/ai/classify', request, token);
  return unwrap(response);
}

/**
 * Fachada de IA usada por las pantallas web.
 */
export const geminiBackendClient = {
  enviarMensajeIa,
  clasificarSolicitudIa,
};
