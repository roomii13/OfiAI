/**
 * @archivo lib/api/client.ts
 * @descripcion Cliente HTTP base para comunicarse con el backend de OfiAI.
 * Abstrae todas las llamadas a la API REST.
 * @modulo Lib
 */
import { configuracion } from "../config";
import { auth } from "../firebase";

const API_BASE_URL = configuracion.api.baseUrl;
const MAX_RETRIES = 1;

interface OpcionesRequest extends RequestInit {
  token?: string;
}

let currentAuthToken: string | null = null;

/**
 * Actualiza el token usado por defecto en llamadas autenticadas.
 */
export function setAuthToken(token: string | null): void {
  currentAuthToken = token;
}

/**
 * Devuelve el token actual del cliente HTTP.
 */
export function getAuthToken(): string | null {
  return currentAuthToken;
}

/**
 * Construye una URL absoluta respetando endpoints con slash inicial.
 */
function buildUrl(endpoint: string): string {
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${normalizedEndpoint}`;
}

/**
 * Fusiona headers de aplicación, autorización y headers personalizados.
 */
async function buildHeaders(headers: HeadersInit | undefined, token?: string): Promise<Headers> {
  const merged = new Headers(headers);
  await auth?.authStateReady();
  const resolvedToken = auth?.currentUser ? await auth.currentUser.getIdToken() : token ?? currentAuthToken;

  if (!merged.has("Content-Type")) {
    merged.set("Content-Type", "application/json");
  }

  if (resolvedToken) {
    merged.set("Authorization", `Bearer ${resolvedToken}`);
  }

  return merged;
}

/**
 * Determina si una respuesta puede reintentarse por error transitorio.
 */
function shouldRetry(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Extrae el mensaje de error estándar devuelto por el backend.
 */
async function readErrorMessage(response: Response): Promise<string> {
  const fallback = `Error HTTP ${response.status}`;
  const body = await response.json().catch(() => null) as { mensaje?: string; message?: string; error?: string } | null;

  return body?.mensaje ?? body?.message ?? body?.error ?? fallback;
}

/**
 * Ejecuta una llamada fetch con manejo centralizado de headers, errores y reintento corto.
 */
export const apiClient = async <T>(
  endpoint: string,
  opciones: OpcionesRequest = {}
): Promise<T> => {
  const { token, ...fetchOpciones } = opciones;
  const request: RequestInit = {
    ...fetchOpciones,
    headers: await buildHeaders(fetchOpciones.headers, token),
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(buildUrl(endpoint), request);

    if (response.ok) {
      if (response.status === 204) {
        return undefined as T;
      }

      const body: unknown = await response.json();
      if (body && typeof body === 'object' && 'exito' in body && body.exito === false) {
        throw new Error('mensaje' in body && typeof body.mensaje === 'string' ? body.mensaje : 'No se pudo completar la solicitud.');
      }
      return body as T;
    }

    if (attempt < MAX_RETRIES && request.method === 'GET' && shouldRetry(response.status)) {
      await new Promise(resolve => window.setTimeout(resolve, 350));
      continue;
    }

    throw new Error(await readErrorMessage(response));
  }

  throw new Error("No fue posible completar la solicitud.");
};

/**
 * Fachada tipada para los verbos HTTP usados por las pantallas web.
 */
export const api = {
  /** Actualiza campos puntuales de un recurso. */
  patch: <T>(endpoint: string, datos: unknown) => apiClient<T>(endpoint, { method: 'PATCH', body: JSON.stringify(datos) }),
  /** Lee un recurso sin modificarlo. */
  get: <T>(endpoint: string, token?: string) => apiClient<T>(endpoint, { method: 'GET', token }),
  /** Crea un recurso sin reintentar automaticamente escrituras. */
  post: <T>(endpoint: string, datos: unknown, token?: string) => apiClient<T>(endpoint, { method: 'POST', body: JSON.stringify(datos), token }),
  /** Guarda los cambios completos del recurso. */
  put: <T>(endpoint: string, datos: unknown, token?: string) => apiClient<T>(endpoint, { method: 'PUT', body: JSON.stringify(datos), token }),
  /** Solicita la eliminacion o cancelacion al backend. */
  delete: <T>(endpoint: string, token?: string) => apiClient<T>(endpoint, { method: 'DELETE', token }),
};
