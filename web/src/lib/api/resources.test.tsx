/**
 * @archivo resources.test.tsx
 * @descripcion Aislamiento de recursos por cuenta y descarte de respuestas atrasadas.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useApiResource } from './resources';

const state = vi.hoisted(() => ({ user: { id: 'account-1' } as null | { id: string }, get: vi.fn() }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('./client', () => ({ api: { get: state.get } }));

/** Crea una respuesta pendiente controlada por la prueba. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(complete => { resolve = complete; });
  return { promise, resolve };
}
beforeEach(() => { state.user = { id: 'account-1' }; state.get.mockReset(); });
afterEach(cleanup);

describe('Recursos web', () => {
  it('no consulta rutas deshabilitadas ni muestra carga permanente sin cuenta', () => {
    const { result, rerender } = renderHook(({ path }) => useApiResource(path), { initialProps: { path: null as string | null } });
    expect(result.current.loading).toBe(false);
    state.user = null;
    rerender({ path: '/jobs' });
    expect(result.current.loading).toBe(false);
    expect(state.get).not.toHaveBeenCalled();
  });
  it('ignora la respuesta de la ruta anterior', async () => {
    const first = deferred<unknown>();
    state.get.mockReturnValueOnce(first.promise).mockResolvedValueOnce({ exito: true, datos: ['actual'] });
    const { result, rerender } = renderHook(({ path }) => useApiResource<string[]>(path), { initialProps: { path: '/old' } });
    rerender({ path: '/current' });
    await waitFor(() => expect(result.current.data).toEqual(['actual']));
    await act(async () => { first.resolve({ exito: true, datos: ['anterior'] }); });
    expect(result.current.data).toEqual(['actual']);
  });
  it('oculta datos de la cuenta anterior durante el cambio de usuario', async () => {
    const second = deferred<unknown>();
    state.get.mockResolvedValueOnce({ exito: true, datos: ['privado-1'] }).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(() => useApiResource<string[]>('/jobs'));
    await waitFor(() => expect(result.current.data).toEqual(['privado-1']));
    state.user = { id: 'account-2' };
    rerender();
    expect(result.current.data).toBeUndefined();
    expect(result.current.loading).toBe(true);
    await act(async () => { second.resolve({ exito: true, datos: ['privado-2'] }); });
    expect(result.current.data).toEqual(['privado-2']);
  });
  it('expone errores y recarga desde la API', async () => {
    state.get.mockRejectedValueOnce(new Error('Sin conexion')).mockResolvedValueOnce({ exito: true, datos: [] });
    const { result } = renderHook(() => useApiResource<string[]>('/jobs'));
    await waitFor(() => expect(result.current.error).toBe('Sin conexion'));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(result.current.error).toBe('');
  });
});
