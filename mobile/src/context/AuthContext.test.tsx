/** @archivo AuthContext.test.tsx @descripcion Regresiones de invalidacion, restauracion y cierre sin red. */
import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { getIdToken, signOut } from 'firebase/auth';
import { ApiMobileError, apiMobile, getApiMobileToken, setApiMobileToken } from '../lib/api';
import { AuthProviderMobile, useAuthMobile, type EstadoAuthMobile } from './AuthContext';

const mockStorage = new Map<string, string>();
const mockAuth = {
  currentUser: null as { uid: string } | null,
  authStateReady: jest.fn(async () => undefined),
};
let mockTokenListener: ((user: { uid: string } | null) => void) | undefined;

jest.mock('../constants', () => ({ API_URL: 'http://localhost/test', DEMO_ACCESS_ENABLED: true }));
jest.mock('../lib/firebase', () => ({ get firebaseAuthMobile() { return mockAuth; } }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
  deleteItemAsync: jest.fn(async (key: string) => { mockStorage.delete(key); }),
}));
jest.mock('firebase/auth', () => ({
  getIdToken: jest.fn(async () => 'fresh-test-token'),
  onIdTokenChanged: jest.fn((_auth, listener) => {
    mockTokenListener = listener;
    return () => { mockTokenListener = undefined; };
  }),
  signOut: jest.fn(async () => {
    mockAuth.currentUser = null;
    mockTokenListener?.(null);
  }),
  signInWithCustomToken: jest.fn(async () => ({ user: mockAuth.currentUser })),
}));
jest.mock('../lib/api', () => ({
  ...jest.requireActual('../lib/api'),
  apiMobile: { get: jest.fn(), post: jest.fn() },
}));

const profile = { id: 'company-user', nombre: 'Empresa', email: 'empresa@example.test', rol: 'empresa' };
const cached = { uid: profile.id, nombre: profile.nombre, email: profile.email, rol: 'empresa', pais: 'AR', plan: 'empresa' };
let state: EstadoAuthMobile;

/** Expone el contexto real renderizado para observar sus transiciones. */
function Probe(): null {
  state = useAuthMobile();
  return null;
}

/** Controla una respuesta tardia sin conexiones externas. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

/** Monta el proveedor y espera a que termine la restauracion. */
async function mountSession(): Promise<ReturnType<typeof render>> {
  const view = render(<AuthProviderMobile><Probe /></AuthProviderMobile>);
  await waitFor(() => expect(state.cargando).toBe(false));
  return view;
}

beforeEach(() => {
  mockStorage.clear();
  mockStorage.set('ofiai.mobile.auth', JSON.stringify({ usuario: cached, token: 'legacy-token' }));
  mockAuth.currentUser = { uid: profile.id };
  mockTokenListener = undefined;
  setApiMobileToken(null);
  jest.mocked(getIdToken).mockResolvedValue('fresh-test-token');
  jest.mocked(apiMobile.get).mockReset().mockResolvedValue({ exito: true, datos: { usuario: profile } });
  jest.mocked(apiMobile.post).mockReset().mockResolvedValue({ exito: true });
});

it('restaura con Firebase y guarda el perfil sin ID token', async () => {
  await mountSession();
  expect(state.estaAutenticado).toBe(true);
  expect(state.token).toBe('fresh-test-token');
  expect(JSON.parse(mockStorage.get('ofiai.mobile.auth')!)).not.toHaveProperty('token');
});
it('conserva la identificacion OWNER del servidor y su acceso administrativo',async()=>{
  jest.mocked(apiMobile.get).mockResolvedValue({exito:true,datos:{usuario:{...profile,rol:'admin',financialRole:'OWNER'}}});
  await mountSession();
  expect(state.usuario).toMatchObject({rol:'admin',financialRole:'OWNER'});
  expect(state.estaAutenticado).toBe(true);
});

it.each([401, 403])('descarta el cache si /auth/me responde %s', async status => {
  jest.mocked(apiMobile.get).mockRejectedValue(new ApiMobileError('Acceso rechazado', status));
  await mountSession();
  expect(state.estaAutenticado).toBe(false);
  expect(state.token).toBeNull();
  expect(getApiMobileToken()).toBeNull();
  expect(mockStorage.has('ofiai.mobile.auth')).toBe(false);
  expect(signOut).toHaveBeenCalled();
});

it('no conserva un perfil distinto al usuario autenticado', async () => {
  jest.mocked(apiMobile.get).mockResolvedValue({ exito: true, datos: { usuario: { ...profile, id: 'other' } } });
  await mountSession();
  expect(state.estaAutenticado).toBe(false);
});

it('permite el cache del mismo usuario durante una caida de red', async () => {
  jest.mocked(apiMobile.get).mockRejectedValue(new TypeError('Network request failed'));
  await mountSession();
  expect(state.usuario?.uid).toBe(profile.id);
  expect(state.estaAutenticado).toBe(true);
});

it('no restaura cache de otra cuenta cuando no hay red', async () => {
  mockStorage.set('ofiai.mobile.auth', JSON.stringify({ usuario: { ...cached, uid: 'other' } }));
  jest.mocked(apiMobile.get).mockRejectedValue(new TypeError('Network request failed'));
  await mountSession();
  expect(state.estaAutenticado).toBe(false);
});

it('limpia UI, token y persistencia cuando Firebase invalida al usuario', async () => {
  await mountSession();
  await act(async () => { mockAuth.currentUser = null; mockTokenListener?.(null); });
  expect(state.estaAutenticado).toBe(false);
  expect(state.token).toBeNull();
  expect(getApiMobileToken()).toBeNull();
  expect(mockStorage.has('ofiai.mobile.auth')).toBe(false);
});

it('limpia una renovacion revocada y tolera errores de red al renovar', async () => {
  await mountSession();
  jest.mocked(getIdToken).mockRejectedValueOnce({ code: 'auth/network-request-failed' });
  await act(async () => { mockTokenListener?.(mockAuth.currentUser); });
  expect(state.estaAutenticado).toBe(true);
  jest.mocked(getIdToken).mockRejectedValueOnce({ code: 'auth/user-token-expired' });
  await act(async () => { mockTokenListener?.(mockAuth.currentUser); });
  expect(state.estaAutenticado).toBe(false);
  expect(mockStorage.has('ofiai.mobile.auth')).toBe(false);
});

it('ignora un evento null atrasado si Firebase conserva al usuario actual', async () => {
  await mountSession();
  await act(async () => { mockTokenListener?.(null); });
  expect(state.estaAutenticado).toBe(true);
  expect(state.usuario?.uid).toBe(profile.id);
});

it('cierra localmente aunque la API de logout no responda, y sigue cerrado al remontar', async () => {
  const view = await mountSession();
  const pending = deferred<unknown>();
  jest.mocked(apiMobile.post).mockReturnValue(pending.promise);
  await act(async () => { await state.cerrarSesion(); });
  expect(state.estaAutenticado).toBe(false);
  expect(apiMobile.post).toHaveBeenCalledWith('/auth/logout', {}, 'fresh-test-token', 5000);
  expect(mockStorage.has('ofiai.mobile.auth')).toBe(false);
  view.unmount();
  await mountSession();
  expect(state.estaAutenticado).toBe(false);
  pending.resolve({ exito: true });
});

it('ignora un perfil que llega despues del cierre de sesion', async () => {
  const pending = deferred<unknown>();
  jest.mocked(apiMobile.get).mockReturnValue(pending.promise);
  render(<AuthProviderMobile><Probe /></AuthProviderMobile>);
  await waitFor(() => expect(apiMobile.get).toHaveBeenCalled());
  await act(async () => { await state.cerrarSesion(); });
  await act(async () => { pending.resolve({ exito: true, datos: { usuario: profile } }); });
  expect(state.estaAutenticado).toBe(false);
  expect(getApiMobileToken()).toBeNull();
  expect(mockStorage.has('ofiai.mobile.auth')).toBe(false);
});

it('no pierde el modo demo por el evento inicial null de Firebase', async () => {
  mockAuth.currentUser = null;
  mockStorage.set('ofiai.mobile.auth', JSON.stringify({ usuario: cached, token: 'demo-token-empresa' }));
  await mountSession();
  await act(async () => { mockTokenListener?.(null); });
  expect(state.estaAutenticado).toBe(true);
  await act(async () => { await state.cerrarSesion(); });
  expect(state.estaAutenticado).toBe(false);
  expect(apiMobile.post).not.toHaveBeenCalled();
});
