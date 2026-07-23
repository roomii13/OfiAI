/**
 * @archivo mobile/src/lib/api.ts
 * @descripcion Cliente HTTP para la aplicación móvil de OfiAI.
 * Sincroniza datos con el backend a través de la misma API REST que la web.
 * @modulo Mobile Lib
 */
import { API_URL } from '../constants';

/**
 * Cliente API base para mobile.
 * TODO: Agregar token de autenticación de Firebase
 * TODO: Agregar manejo de errores de red (sin conexión)
 * TODO: Agregar caché offline para mejorar UX
 */
export const apiMobile = {
  get: async <T>(endpoint: string): Promise<T> => {
    // TODO: Implementar con token de auth
    const respuesta = await fetch(`${API_URL}${endpoint}`);
    return respuesta.json();
  },
  post: async <T>(endpoint: string, datos: unknown): Promise<T> => {
    // TODO: Implementar
    const respuesta = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
    return respuesta.json();
  },
};
