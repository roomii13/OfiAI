/**
 * @archivo client.test.ts
 * @descripcion Autorizacion y manejo de fallos HTTP sin llamadas externas.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, getAuthToken, setAuthToken } from './client';

const firebase = vi.hoisted(() => ({
  auth: { authStateReady: vi.fn().mockResolvedValue(undefined),
    currentUser: null as null | { getIdToken: () => Promise<string> } },
}));
vi.mock('../firebase', () => firebase);
vi.mock('../config', () => ({ configuracion: { api: { baseUrl: 'https://api.example.test/api/v1' } } }));
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  firebase.auth.currentUser = null;
  setAuthToken(null);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Cliente HTTP web', () => {
  it('prefiere el ID token actualizado de Firebase al token almacenado', async () => {
    setAuthToken('expired-token');
    firebase.auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('fresh-token') };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ exito: true, datos: [] })));
    await api.get('/jobs', 'older-explicit-token');
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer fresh-token');
  });
  it('no emite una solicitud cuando Firebase rechaza la renovacion del token', async () => {
    firebase.auth.currentUser = { getIdToken: vi.fn().mockRejectedValue(new Error('Sesion vencida')) };
    await expect(api.get('/jobs')).rejects.toThrow('Sesion vencida');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('limpia la autorizacion tras salir', async () => {
    setAuthToken('test-token');
    setAuthToken(null);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ exito: true })));
    await api.get('/subscriptions/plans');
    expect(getAuthToken()).toBeNull();
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).has('Authorization')).toBe(false);
  });
  it('reintenta una lectura transitoria una unica vez', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ exito: true, datos: [] })));
    const request = api.get('/jobs');
    await vi.runAllTimersAsync();
    await expect(request).resolves.toEqual({ exito: true, datos: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('no duplica una publicacion ante un error transitorio', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ mensaje: 'No disponible' }), { status: 503 }));
    await expect(api.post('/jobs', { titulo: 'Trabajo' })).rejects.toThrow('No disponible');
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it('propaga los rechazos de negocio incluso si el HTTP fue exitoso', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ exito: false, mensaje: 'No guardado' })));
    await expect(api.put('/auth/preferences', {})).rejects.toThrow('No guardado');
  });
  it('acepta respuestas sin contenido', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api.delete('/jobs/job-1')).resolves.toBeUndefined();
  });
});
