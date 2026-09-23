/**
 * @archivo resources.ts
 * @descripcion Recursos moviles reales que se refrescan al volver a la pantalla.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthMobile } from '../context/AuthContext';
import { apiMobile } from './api';
import type { ApiResult, Role } from '../../../shared/contracts';

/** Devuelve el dashboard del rol autenticado. */
export function dashboardPath(role: Role): string {
  return `/dashboard/${{ empresa: 'company', profesional: 'professional', admin: 'admin' }[role]}`;
}

/** Formatea nombres de indicadores del servidor. */
export function metricLabel(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, value => value.toUpperCase());
}

/** Revalida por cuenta, endpoint, foco y reintento; descarta respuestas obsoletas. */
export function useMobileResource<T>(endpoint: string | null) {
  const { usuario } = useAuthMobile();
  const userId = usuario?.uid;
  const key = `${userId ?? ''}:${endpoint}`;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; data?: T; error: string; loading: boolean }>({ key: '', error: '', loading: true });
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useFocusEffect(useCallback(() => {
    let active = true;
    if (!endpoint || !userId) return;
    setState({ key, loading: true, error: '' });
    void apiMobile.get<ApiResult<T>>(endpoint).then(result => {
      if (!result.exito) throw new Error(result.mensaje ?? 'No se pudo leer el recurso.');
      if (active) setState({ key, data: result.datos, loading: false, error: '' });
    }).catch(error => {
      if (active) setState({ key, loading: false, error: error instanceof Error ? error.message : 'Error de conexion.' });
    });
    return () => { active = false; };
  }, [endpoint, key, userId, revision]));
  return { data: state.key === key ? state.data : undefined, error: state.key === key ? state.error : '',
    loading: Boolean(endpoint) && (state.key !== key || state.loading), reload };
}
