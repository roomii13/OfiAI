/**
 * @archivo metrics.ts
 * @descripcion Métricas del sistema para OfiAI.
 * @modulo Monitoring
 */
interface SnapshotMetricas {
  contadores: Record<string, number>;
  gauges: Record<string, number>;
  latencias: Record<string, { total: number; muestras: number; promedio: number }>;
}

const contadores = new Map<string, number>();
const gauges = new Map<string, number>();
const latencias = new Map<string, { total: number; muestras: number }>();

/**
 * Registro simple de métricas en memoria para exponer o adaptar a proveedores externos.
 */
export const metricas = {
  /**
   * Incrementa un contador acumulativo.
   */
  incrementarContador(nombre: string, cantidad = 1): void {
    contadores.set(nombre, (contadores.get(nombre) ?? 0) + cantidad);
  },

  /**
   * Establece el valor actual de un gauge.
   */
  establecerGauge(nombre: string, valor: number): void {
    gauges.set(nombre, valor);
  },

  /**
   * Registra una muestra de latencia en milisegundos.
   */
  observarLatencia(nombre: string, milisegundos: number): void {
    const actual = latencias.get(nombre) ?? { total: 0, muestras: 0 };
    latencias.set(nombre, {
      total: actual.total + milisegundos,
      muestras: actual.muestras + 1,
    });
  },

  /**
   * Devuelve una copia serializable de las métricas actuales.
   */
  snapshot(): SnapshotMetricas {
    return {
      contadores: Object.fromEntries(contadores),
      gauges: Object.fromEntries(gauges),
      latencias: Object.fromEntries(
        [...latencias.entries()].map(([nombre, valor]) => [
          nombre,
          {
            ...valor,
            promedio: valor.muestras > 0 ? valor.total / valor.muestras : 0,
          },
        ])
      ),
    };
  },
};
