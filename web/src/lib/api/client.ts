/**
 * @archivo lib/api/client.ts
 * @descripcion Cliente HTTP base para comunicarse con el backend de OfiAI.
 * Abstrae todas las llamadas a la API REST.
 * @modulo Lib
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

interface OpcionesRequest extends RequestInit {
  token?: string;
}

/**
 * Función base de fetch con manejo de errores.
 * TODO: Agregar interceptor para adjuntar token de Firebase Auth automáticamente
 * TODO: Agregar manejo de token expirado con refresh
 * TODO: Agregar retry con exponential backoff
 */
export const apiClient = async <T>(
  endpoint: string,
  opciones: OpcionesRequest = {}
): Promise<T> => {
  const { token, ...fetchOpciones } = opciones;
  
  const respuesta = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...fetchOpciones,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...fetchOpciones.headers,
    },
  });

  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({ mensaje: 'Error de red' }));
    throw new Error(error.mensaje || `Error HTTP ${respuesta.status}`);
  }

  return respuesta.json();
};

export const api = {
  get: <T>(endpoint: string, token?: string) => apiClient<T>(endpoint, { method: 'GET', token }),
  post: <T>(endpoint: string, datos: unknown, token?: string) => apiClient<T>(endpoint, { method: 'POST', body: JSON.stringify(datos), token }),
  put: <T>(endpoint: string, datos: unknown, token?: string) => apiClient<T>(endpoint, { method: 'PUT', body: JSON.stringify(datos), token }),
  delete: <T>(endpoint: string, token?: string) => apiClient<T>(endpoint, { method: 'DELETE', token }),
};
