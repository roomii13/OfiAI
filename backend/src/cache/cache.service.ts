/**
 * @archivo cache.service.ts
 * @descripcion Servicio de caché para OfiAI.
 * Abstrae el mecanismo de caché (Redis en producción, en memoria en desarrollo).
 * @modulo Cache
 */
import { logger } from '../config/logger';

export interface ServicioCache {
  obtener<T>(clave: string): Promise<T | null>;
  establecer<T>(clave: string, valor: T, ttlSegundos?: number): Promise<void>;
  eliminar(clave: string): Promise<void>;
  limpiarPorPatron(patron: string): Promise<void>;
}

/**
 * Implementación en memoria para desarrollo.
 * TODO: Reemplazar con RedisCache en producción cuando REDIS_ENABLED=true
 * TODO: Implementar estrategia de evicción LRU
 */
class CacheMemoria implements ServicioCache {
  private almacen = new Map<string, { valor: unknown; expira: number }>();

  async obtener<T>(clave: string): Promise<T | null> {
    const entrada = this.almacen.get(clave);
    if (!entrada) return null;
    if (Date.now() > entrada.expira) {
      this.almacen.delete(clave);
      return null;
    }
    return entrada.valor as T;
  }

  async establecer<T>(clave: string, valor: T, ttlSegundos = 300): Promise<void> {
    this.almacen.set(clave, { valor, expira: Date.now() + ttlSegundos * 1000 });
  }

  async eliminar(clave: string): Promise<void> {
    this.almacen.delete(clave);
  }

  async limpiarPorPatron(patron: string): Promise<void> {
    // TODO: Implementar limpieza por patrón de clave
    logger.debug(`Limpiar caché por patrón: ${patron}`);
  }
}

export const cache: ServicioCache = new CacheMemoria();
