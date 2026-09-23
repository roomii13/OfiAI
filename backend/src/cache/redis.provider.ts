/**
 * @archivo redis.provider.ts
 * @descripcion Proveedor compatible con Redis para caché en producción de OfiAI.
 * Mantiene una implementación funcional en memoria hasta incorporar un cliente Redis externo.
 * @modulo Cache
 */
import { logger } from '../config/logger';
import { ServicioCache } from './cache.service';

/**
 * Implementación compatible con ServicioCache usada cuando Redis no está conectado.
 */
export class CacheRedis implements ServicioCache {
  private readonly almacen = new Map<string, { valor: unknown; expira: number }>();

  /**
   * Obtiene un valor cacheado o null si expiró.
   */
  async obtener<T>(clave: string): Promise<T | null> {
    const entrada = this.almacen.get(clave);

    if (!entrada) {
      return null;
    }

    if (Date.now() > entrada.expira) {
      this.almacen.delete(clave);
      return null;
    }

    return entrada.valor as T;
  }

  /**
   * Guarda un valor con TTL compatible con Redis.
   */
  async establecer<T>(clave: string, valor: T, ttlSegundos = 300): Promise<void> {
    this.almacen.set(clave, {
      valor,
      expira: Date.now() + ttlSegundos * 1000,
    });
  }

  /**
   * Elimina una clave específica.
   */
  async eliminar(clave: string): Promise<void> {
    this.almacen.delete(clave);
  }

  /**
   * Elimina claves por patrón con comodín `*`.
   */
  async limpiarPorPatron(patron: string): Promise<void> {
    const regex = new RegExp(`^${patron.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    let eliminadas = 0;

    for (const clave of this.almacen.keys()) {
      if (regex.test(clave)) {
        this.almacen.delete(clave);
        eliminadas += 1;
      }
    }

    logger.debug('CacheRedis compatible limpió claves por patrón.', { patron, eliminadas });
  }
}
