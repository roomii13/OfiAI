import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, setAuthToken } from './client';
import { authenticateDemo, DEMO_ACCOUNTS } from './demo';
const state = vi.hoisted(() => ({ config: { app: { demoAccessEnabled: true }, api: { baseUrl: 'https://api.example.test/api/v1' } } }));
vi.mock('../firebase', () => ({ auth: null }));
vi.mock('../config', () => ({ configuracion: state.config }));
const fetchMock = vi.fn();
beforeEach(() => { state.config.app.demoAccessEnabled = true; fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); setAuthToken(null); });
afterEach(() => { vi.unstubAllGlobals(); setAuthToken(null); });
describe('Acceso publico de demostracion', () => {
  it.each(DEMO_ACCOUNTS)('acepta las credenciales publicas de $role y rechaza una contraseña incorrecta', account => {
    expect(authenticateDemo(' ' + account.email.toUpperCase() + ' ', account.password)).toBe(account.role);
    expect(() => authenticateDemo(account.email, 'incorrecta')).toThrow('incorrectos');
    expect(authenticateDemo('cuenta-real@example.test', account.password)).toBeNull();
  });
  it('mantiene las lecturas demo fuera del backend real', async () => {
    setAuthToken('demo-token-empresa');
    const result = await api.get<{ datos: { rol: string } }>('/dashboard/company');
    expect(result.datos.rol).toBe('empresa');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rechaza todas las escrituras y las funciones no incluidas sin solicitudes externas', async () => {
    setAuthToken('demo-token-admin');
    for (const request of [api.post('/jobs', {}), api.put('/auth/preferences', {}), api.patch('/admin/users/real/status', {}), api.delete('/jobs/real')]) {
      await expect(request).rejects.toThrow('solo lectura');
    }
    await expect(api.get('/unknown')).rejects.toThrow('no forma parte');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('impide escalar el rol mediante otra ruta de lectura', async () => {
    setAuthToken('demo-token-profesional');
    await expect(api.get('/dashboard/admin')).rejects.toThrow('rol demo');
    await expect(api.get('/admin/users')).rejects.toThrow('administrador');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('rechaza tokens sinteticos desconocidos y respeta el demo deshabilitado', async () => {
    setAuthToken('demo-token-inventado');
    await expect(api.get('/jobs')).rejects.toThrow('inválida');
    state.config.app.demoAccessEnabled = false;
    setAuthToken('demo-token-admin');
    await expect(api.get('/jobs')).rejects.toThrow('deshabilitado');
    expect(() => authenticateDemo(DEMO_ACCOUNTS[0].email, DEMO_ACCOUNTS[0].password)).toThrow('deshabilitado');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
