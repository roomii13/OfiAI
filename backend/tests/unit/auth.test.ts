/** @archivo auth.test.ts @descripcion Regresiones de autenticacion y recuperacion. */
import { verifyFirebasePassword } from '../../src/integrations/firebase/auth';
import { authService } from '../../src/services/auth.service';
import { firebaseAuth } from '../../src/integrations/firebase/admin';
import { userRepository } from '../../src/repositories/user.repository';
import { enviarEmailResend } from '../../src/integrations/resend';
import type { Usuario } from '../../src/models/User';

jest.mock('../../src/integrations/firebase/admin', () => ({
  firebaseAuth: { createCustomToken: jest.fn(), generatePasswordResetLink: jest.fn() },
  firestore: { collection: jest.fn() },
}));
jest.mock('../../src/repositories/user.repository', () => ({ userRepository: { findByEmail: jest.fn(), update: jest.fn() } }));
jest.mock('../../src/integrations/resend', () => ({ enviarEmailResend: jest.fn() }));

const fetchMock = jest.spyOn(globalThis, 'fetch');
const user: Usuario = { id: 'owner', email: 'owner@example.com', nombre: 'Owner', rol: 'empresa', pais: 'AR',
  activo: true, emailVerificado: true, idioma: 'es-LA', fechaCreacion: new Date(), fechaActualizacion: new Date() };

beforeEach(() => {
  fetchMock.mockReset();
  jest.mocked(userRepository.findByEmail).mockResolvedValue(user);
  jest.mocked(firebaseAuth.createCustomToken).mockResolvedValue('custom-token');
});
afterAll(() => fetchMock.mockRestore());

it('rechaza una clave incorrecta antes de emitir un token', async () => {
  fetchMock.mockResolvedValue(new Response('{}', { status: 400 }));
  await expect(authService.login({ email: user.email, password: 'incorrecta' })).rejects.toMatchObject({ codigoEstado: 401 });
  expect(firebaseAuth.createCustomToken).not.toHaveBeenCalled();
});
it('no usa un UID distinto del perfil persistido', async () => {
  fetchMock.mockResolvedValue(Response.json({ localId: 'otro-uid' }));
  await expect(authService.login({ email: user.email, password: 'correcta' })).rejects.toMatchObject({ codigoEstado: 401 });
  expect(firebaseAuth.createCustomToken).not.toHaveBeenCalled();
});
it('emite sesion solo despues de comprobar email y password con Firebase', async () => {
  fetchMock.mockResolvedValue(Response.json({ localId: user.id }));
  const result = await authService.login({ email: user.email, password: 'correcta' });
  expect(result.customToken).toBe('custom-token');
  expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ email: user.email, password: 'correcta', returnSecureToken: true });
});
it('rechaza cuentas suspendidas aunque la clave sea correcta', async () => {
  fetchMock.mockResolvedValue(Response.json({ localId: user.id }));
  jest.mocked(userRepository.findByEmail).mockResolvedValue({ ...user, activo: false });
  await expect(authService.login({ email: user.email, password: 'correcta' })).rejects.toMatchObject({ codigoEstado: 403 });
});
it('trata una falla de Firebase como indisponibilidad, sin conceder acceso', async () => {
  fetchMock.mockRejectedValue(new Error('offline'));
  await expect(verifyFirebasePassword(user.email, 'correcta')).rejects.toMatchObject({ codigoEstado: 503 });
});
it('envia la recuperacion por email y no devuelve el enlace', async () => {
  jest.mocked(firebaseAuth.generatePasswordResetLink).mockResolvedValue('https://example.test/reset');
  await expect(authService.recoverPassword(user.email)).resolves.toBeUndefined();
  expect(enviarEmailResend).toHaveBeenCalledWith(expect.objectContaining({ to: user.email, text: expect.stringContaining('https://example.test/reset') }));
});
it('mantiene la misma respuesta para correos inexistentes', async () => {
  jest.mocked(userRepository.findByEmail).mockResolvedValue(null);
  await expect(authService.recoverPassword('absent@example.com')).resolves.toBeUndefined();
  expect(enviarEmailResend).not.toHaveBeenCalled();
});
