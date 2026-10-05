/** @archivo api.test.ts @descripcion Errores tipados, invalidacion selectiva y timeouts HTTP. */
import { ApiMobileError, onApiMobileSessionInvalidated, request, setApiMobileToken } from './api';

const mockAuth = { authStateReady: jest.fn(async () => undefined), currentUser: null as null | { getIdToken: () => Promise<string> } };
jest.mock('./firebase', () => ({ get firebaseAuthMobile() { return mockAuth; } }));
jest.mock('../constants', () => ({ API_URL: 'http://localhost/test' }));
const originalFetch = global.fetch;

/** Fabrica una respuesta HTTP sin iniciar servicios externos. */
function response(status: number): Response {
  return { ok: status < 400, status, json: async () => ({ mensaje: 'Respuesta de prueba' }) } as Response;
}

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue(response(200));
  mockAuth.currentUser = null;
  setApiMobileToken('active-token');
});
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

it.each([401, 403])('notifica el rechazo %s del perfil y preserva el status', async status => {
  jest.mocked(fetch).mockResolvedValue(response(status));
  const invalidated = jest.fn();
  const unsubscribe = onApiMobileSessionInvalidated(invalidated);
  await expect(request('/auth/me')).rejects.toMatchObject({ status });
  expect(invalidated).toHaveBeenCalledTimes(1);
  unsubscribe();
});

it('un 403 de permisos no cierra la sesion', async () => {
  jest.mocked(fetch).mockResolvedValue(response(403));
  const invalidated = jest.fn();
  const unsubscribe = onApiMobileSessionInvalidated(invalidated);
  await expect(request('/admin')).rejects.toBeInstanceOf(ApiMobileError);
  expect(invalidated).not.toHaveBeenCalled();
  unsubscribe();
});

it('una peticion vieja no invalida el token actual', async () => {
  jest.mocked(fetch).mockResolvedValue(response(401));
  const invalidated = jest.fn();
  const unsubscribe = onApiMobileSessionInvalidated(invalidated);
  await expect(request('/auth/me', {}, 'old-token')).rejects.toMatchObject({ status: 401 });
  expect(invalidated).not.toHaveBeenCalled();
  unsubscribe();
});

it('usa el token explicito de logout incluso cuando Firebase cambio de cuenta', async () => {
  mockAuth.currentUser = { getIdToken: jest.fn(async () => 'new-user-token') };
  await request('/auth/logout', { method: 'POST' }, 'logout-token');
  const headers = jest.mocked(fetch).mock.calls[0][1]?.headers as Headers;
  expect(headers.get('Authorization')).toBe('Bearer logout-token');
  expect(mockAuth.currentUser.getIdToken).not.toHaveBeenCalled();
});

it('termina por timeout aunque el transporte no responda al abort', async () => {
  jest.useFakeTimers();
  jest.mocked(fetch).mockImplementation(() => new Promise<Response>(resolve => {
    setTimeout(() => resolve(response(200)), 10000);
  }));
  const pending = request('/slow', { timeoutMs: 100 });
  const assertion = expect(pending).rejects.toMatchObject({ status: 0 });
  await jest.advanceTimersByTimeAsync(100);
  await assertion;
  expect(jest.mocked(fetch).mock.calls[0][1]?.signal?.aborted).toBe(true);
});

it('no envia una peticion ya cancelada', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(request('/cancelled', { signal: controller.signal })).rejects.toMatchObject({ status: 0 });
  expect(fetch).not.toHaveBeenCalled();
});
