/**
 * @archivo mobile/src/lib/api.ts
 * @descripcion Cliente HTTP para la aplicación móvil de OfiAI.
 * Sincroniza datos con el backend a través de la misma API REST que la web.
 * @modulo Mobile Lib
 */
import { API_URL } from '../constants';
import { firebaseAuthMobile } from './firebase';

let currentToken: string | null = null;
const invalidationListeners = new Set<() => void>();
const REQUEST_TIMEOUT_MS = 60_000;

/** Error HTTP distinguible de una caida de red; no contiene credenciales. */
export class ApiMobileError extends Error {
  /** Conserva el estado HTTP; cero indica timeout o cancelacion. */
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiMobileError';
  }
}

/** Reconoce rechazo definitivo de sesion, no fallas transitorias de conectividad. */
export function isSessionRejected(error: unknown): boolean {
  if (error instanceof ApiMobileError) return error.status === 401 || error.status === 403;
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  return typeof code === 'string' && [
    'auth/user-disabled', 'auth/user-not-found', 'auth/user-token-expired',
    'auth/invalid-user-token', 'auth/id-token-revoked', 'auth/invalid-refresh-token',
  ].includes(code);
}

/** Observa invalidaciones HTTP sin acoplar el cliente a React. */
export function onApiMobileSessionInvalidated(listener: () => void): () => void {
  invalidationListeners.add(listener);
  return () => { invalidationListeners.delete(listener); };
}

/** Solo invalida la sesion que origino la peticion, nunca una sesion posterior. */
function rejectSession(token: string | null): void {
  if (token && token === currentToken) invalidationListeners.forEach(listener => listener());
}

interface MobileRequestOptions extends RequestInit {
  timeoutMs?: number;
}

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
  if (token !== undefined) return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
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
export async function request<T>(endpoint: string, options: MobileRequestOptions = {}, token?: string): Promise<T> {
  const { timeoutMs = REQUEST_TIMEOUT_MS, signal, ...fetchOptions } = options;
  const controller = new AbortController();
  const sessionToken = currentToken;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let cancel: (() => void) | undefined;
  const interrupted = new Promise<never>((_, reject) => {
    /** Libera la espera incluso si Firebase o el transporte no respetan AbortSignal. */
    cancel = () => {
      controller.abort();
      reject(new ApiMobileError('La solicitud fue cancelada.', 0));
    };
    signal?.addEventListener('abort', cancel, { once: true });
    timeout = setTimeout(() => {
      controller.abort();
      reject(new ApiMobileError('La conexion tardo demasiado. Intenta nuevamente.', 0));
    }, timeoutMs);
    if (signal?.aborted) cancel();
  });

  /** Ejecuta la operacion y conserva el codigo de rechazo para la capa de sesion. */
  async function performRequest(): Promise<T> {
    const headers = new Headers(await buildHeaders(token));
    new Headers(fetchOptions.headers).forEach((value, name) => headers.set(name, value));
    if (controller.signal.aborted) throw new ApiMobileError('La solicitud fue cancelada.', 0);
    const response = await fetch(buildUrl(endpoint), { ...fetchOptions, headers, signal: controller.signal });
    if (!response.ok) {
      const rejectedToken = headers.get('Authorization')?.replace(/^Bearer /, '') ?? null;
      if (response.status === 401 || (endpoint === '/auth/me' && response.status === 403)) {
        rejectSession(rejectedToken);
      }
      throw new ApiMobileError(await readErrorMessage(response), response.status);
    }
    return response.status === 204 ? undefined as T : response.json() as Promise<T>;
  }

  try {
    return await Promise.race([performRequest(), interrupted]);
  } catch (error) {
    // Un 403 de permisos de otro recurso no implica que la sesion sea invalida.
    if (!(error instanceof ApiMobileError) && isSessionRejected(error)) rejectSession(sessionToken);
    throw error;
  } finally {
    clearTimeout(timeout);
    if (cancel) signal?.removeEventListener('abort', cancel);
  }
}

/**
 * Cliente API base para mobile.
 */
export const apiMobile = {
  /** Actualiza campos de un recurso. */
  patch: <T>(endpoint: string, datos: unknown): Promise<T> => request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(datos) }),
  get: <T>(endpoint: string, token?: string): Promise<T> => request<T>(endpoint, { method: 'GET' }, token),
  post: <T>(endpoint: string, datos: unknown, token?: string, timeoutMs?: number): Promise<T> =>
    request<T>(endpoint, { method: 'POST', body: JSON.stringify(datos), timeoutMs }, token),
  put: <T>(endpoint: string, datos: unknown, token?: string): Promise<T> =>
    request<T>(endpoint, { method: 'PUT', body: JSON.stringify(datos) }, token),
  delete: <T>(endpoint: string, token?: string): Promise<T> => request<T>(endpoint, { method: 'DELETE' }, token),
};
