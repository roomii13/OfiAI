/**
 * @archivo mobile/src/lib/api.ts
 * @descripcion Cliente HTTP para la aplicación móvil de OfiAI.
 * Sincroniza datos con el backend a través de la misma API REST que la web.
 * @modulo Mobile Lib
 */
import { API_URL } from '../constants';
import { firebaseAuthMobile } from './firebase';

let currentToken: string | null = null;

/**
 * Actualiza el token usado por las llamadas móviles autenticadas.
 */
export function setApiMobileToken(token: string | null): void {
  currentToken = token;
}

/**
 * Devuelve el token actualmente configurado en el cliente móvil.
 */
export function getApiMobileToken(): string | null {
  return currentToken;
}

/**
 * Construye una URL absoluta para el endpoint solicitado.
 */
function buildUrl(endpoint: string): string {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_URL}${normalizedEndpoint}`;
}

/**
 * Crea headers HTTP consistentes para JSON y autenticación.
 */
async function buildHeaders(token?: string): Promise<HeadersInit> {
  await firebaseAuthMobile?.authStateReady();
  const resolvedToken = firebaseAuthMobile?.currentUser ? await firebaseAuthMobile.currentUser.getIdToken() : token ?? currentToken;
  return {
    'Content-Type': 'application/json',
    ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
  };
}

/**
 * Extrae mensajes de error normalizados del backend.
 */
async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `Error HTTP ${response.status}`;
  const body = await response.json().catch(() => null) as { mensaje?: string; message?: string; error?: string } | null;
  return body?.mensaje ?? body?.message ?? body?.error ?? fallback;
}

/**
 * Ejecuta una llamada HTTP y devuelve JSON tipado.
 */
export async function request<T>(endpoint: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(buildUrl(endpoint), {
    ...options,
    headers: {
      ...await buildHeaders(token),
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

/**
 * Cliente API base para mobile.
 */
export const apiMobile = {
  /** Actualiza campos de un recurso. */
  patch: <T>(endpoint: string, datos: unknown): Promise<T> => request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(datos) }),
  get: <T>(endpoint: string, token?: string): Promise<T> => request<T>(endpoint, { method: 'GET' }, token),
  post: <T>(endpoint: string, datos: unknown, token?: string): Promise<T> =>
    request<T>(endpoint, { method: 'POST', body: JSON.stringify(datos) }, token),
  put: <T>(endpoint: string, datos: unknown, token?: string): Promise<T> =>
    request<T>(endpoint, { method: 'PUT', body: JSON.stringify(datos) }, token),
  delete: <T>(endpoint: string, token?: string): Promise<T> => request<T>(endpoint, { method: 'DELETE' }, token),
};
