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
 * Usa expiración por TTL y una política simple de recorte por capacidad.
 */
class CacheMemoria implements ServicioCache {
  private almacen = new Map<string, { valor: unknown; expira: number }>();
  private readonly capacidadMaxima = 1000;

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
    if (this.almacen.size >= this.capacidadMaxima && !this.almacen.has(clave)) {
      const claveMasAntigua = this.almacen.keys().next().value as string | undefined;
      if (claveMasAntigua) {
        this.almacen.delete(claveMasAntigua);
      }
    }

    this.almacen.set(clave, { valor, expira: Date.now() + ttlSegundos * 1000 });
  }

  async eliminar(clave: string): Promise<void> {
    this.almacen.delete(clave);
  }

  async limpiarPorPatron(patron: string): Promise<void> {
    const regex = new RegExp(`^${patron.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    let eliminadas = 0;

    for (const clave of this.almacen.keys()) {
      if (regex.test(clave)) {
        this.almacen.delete(clave);
        eliminadas += 1;
      }
    }

    logger.debug(`Caché limpiada por patrón: ${patron}`, { eliminadas });
  }
}

export const cache: ServicioCache = new CacheMemoria();
