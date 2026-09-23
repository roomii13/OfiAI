/**
 * @archivo resources.ts
 * @descripcion Lectura autenticada de recursos, sin datos de sustitucion.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from './client';
import type { ApiResult, DashboardData, Role, JobData, PaginationData } from '../../../../shared/contracts';
import type { KpiDashboard, TrabajoResumen } from '../../shared/types';

/** Lee el contrato comun y admite respuestas nulas, como una suscripcion ausente. */
async function getResponse<T>(endpoint: string): Promise<ApiResult<T>> {
  const response = await api.get<ApiResult<T>>(endpoint);
  if (!response.exito) throw new Error(response.mensaje ?? 'No se pudo obtener el recurso.');
  return response;
}

/** Lee los datos sin descartar respuestas nulas validas. */
export async function getData<T>(endpoint: string): Promise<T> {
  return (await getResponse<T>(endpoint)).datos;
}

/** Descarta respuestas antiguas cuando cambian la ruta o la cuenta. */
export function useApiResource<T>(endpoint: string | null) {
  const { user } = useAuth();
  const userId = user?.id;
  const key = userId ? `${userId}:${endpoint}` : '';
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; data?: T; paginacion?: PaginationData; error: string; loading: boolean }>({
    key: '', error: '', loading: true,
  });
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let active = true;
    if (!endpoint || !userId) return;
    setState({ key, error: '', loading: true });
    void getResponse<T>(endpoint).then(
      response => { if (active) setState({ key, data: response.datos, paginacion: response.paginacion, error: '', loading: false }); },
      error => { if (active) setState({ key, error: error instanceof Error ? error.message : 'Error de conexion.', loading: false }); }
    );
    return () => { active = false; };
  }, [endpoint, key, userId, revision]);
  return { data: state.key === key ? state.data : undefined, error: state.key === key ? state.error : '',
    paginacion: state.key === key ? state.paginacion : undefined,
    loading: Boolean(endpoint && userId) && (state.key !== key || state.loading), reload };
}

/** Selecciona exclusivamente el dashboard autorizado para el rol. */
export function dashboardEndpoint(role: Role): string {
  return `/dashboard/${{ empresa: 'company', profesional: 'professional', admin: 'admin' }[role]}`;
}

/** Convierte claves de metricas en etiquetas legibles. */
export function metricLabel(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, letter => letter.toUpperCase());
}

/** Presenta valores obtenidos del servidor sin inventar variaciones. */
export function toMetrics(values: DashboardData['kpis']): KpiDashboard[] {
  return Object.entries(values).map(([key, value]) => ({
    etiqueta: metricLabel(key), valor: typeof value === 'boolean' ? (value ? 'Si' : 'No') : String(value),
    variacion: '', tono: 'neutral',
  }));
}

/** Adapta los trabajos JSON a la lista visual existente. */
export function toJobSummary(job: JobData): TrabajoResumen {
  return { id: job.id, titulo: job.titulo, categoria: job.categoria, estado: job.estado,
    ciudad: job.ciudad ?? '', presupuesto: job.presupuestoMaximo ?? job.presupuestoMinimo ?? 0,
    compatibilidadIa: job.puntajeMatchingIA };
}
