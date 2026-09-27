/** @archivo AgentOperationsScreen.test.tsx @descripcion Flujos nativos de operaciones con API aislada y permisos por rol. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AgentOperationsScreen } from './AgentOperationsScreen';
import { apiMobile } from '../lib/api';
const mockIdentity = { usuario: { uid: 'company-qa', rol: 'empresa' } };
jest.mock('../context/AuthContext', () => ({ useAuthMobile: () => mockIdentity }));
jest.mock('../lib/api', () => ({ apiMobile: { get: jest.fn(), post: jest.fn(), put: jest.fn() } }));
jest.mock('../providers/theme', () => ({ useThemeMobile: () => ({ colores: {
  fondo: '#fff', superficie: '#fff', texto: '#222', textoSuave: '#555', borde: '#ddd', primario: '#286589',
} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '69ceef91-71a4-46b2-8ab8-c9b4902c26c6' }));
const session = { id: 'session-qa', ownerId: 'company-qa', resource: null, status: 'open', messages: [], version: 1,
  createdAt: '2026-09-27T00:00:00Z', updatedAt: '2026-09-27T00:00:00Z' };
beforeEach(() => {
  jest.clearAllMocks(); mockIdentity.usuario.rol = 'empresa';
  (apiMobile.get as jest.Mock).mockImplementation(async (path: string) => ({ exito: true, datos:
    path === '/sales/me' ? null : path.startsWith('/knowledge') ? { documents: [], partial: false }
      : path === '/support/sessions/session-qa' ? session : [] }));
  (apiMobile.post as jest.Mock).mockResolvedValue({ exito: true, datos: session });
  (apiMobile.put as jest.Mock).mockResolvedValue({ exito: true, datos: {} });
});
it('empresa ve sus herramientas sin paneles administrativos', async () => {
  render(<AgentOperationsScreen />);
  await screen.findByText('No hay conversaciones.');
  expect(screen.queryByRole('tab', { name: 'Marketing' })).toBeNull();
  expect(screen.queryByRole('tab', { name: 'Gobierno IA' })).toBeNull();
  expect(apiMobile.get).not.toHaveBeenCalledWith('/support/tickets');
});
it('admin navega a Marketing sin ejecutar publicaciones', async () => {
  mockIdentity.usuario.rol = 'admin'; render(<AgentOperationsScreen />);
  fireEvent.press(screen.getByRole('tab', { name: 'Marketing' }));
  await waitFor(() => expect(apiMobile.get).toHaveBeenCalledWith('/marketing'));
  expect(apiMobile.post).not.toHaveBeenCalled();
});
it('guarda preferencias sin activar consentimiento implicitamente', async () => {
  render(<AgentOperationsScreen />); fireEvent.press(screen.getByRole('tab', { name: 'Preferencias' }));
  const field = await screen.findByLabelText('Que necesitas');
  fireEvent.changeText(field, 'Necesito un electricista');
  const button = screen.getByRole('button', { name: 'Guardar preferencias' });
  await waitFor(() => expect(button.props.accessibilityState.disabled).toBe(false));
  fireEvent.press(button);
  await waitFor(() => expect(apiMobile.put).toHaveBeenCalledWith('/sales/me', {
    need: 'Necesito un electricista', expectedMonthlyVolume: 1, consent: false }));
});
it('no guarda memoria sin autorizacion y muestra el error de API', async () => {
  (apiMobile.get as jest.Mock).mockRejectedValue(new Error('Servicio no disponible'));
  render(<AgentOperationsScreen />); fireEvent.press(screen.getByRole('tab', { name: 'Memoria' }));
  await screen.findByText('Servicio no disponible');
  expect(screen.getByRole('button', { name: 'Guardar memoria' }).props.accessibilityState.disabled).toBe(true);
  expect(apiMobile.post).not.toHaveBeenCalled();
});
it('crea soporte y envia version y UUID sin duplicar solicitudes', async () => {
  render(<AgentOperationsScreen />);
  fireEvent.press(await screen.findByRole('button', { name: 'Nueva conversacion' }));
  fireEvent.changeText(await screen.findByLabelText('Mensaje'), 'Necesito una persona');
  fireEvent.press(screen.getByRole('button', { name: 'Enviar' }));
  await waitFor(() => expect(apiMobile.post).toHaveBeenCalledWith('/support/sessions/session-qa/messages', {
    message: 'Necesito una persona', version: 1, requestId: expect.stringMatching(/^[0-9a-f-]{36}$/) }));
});
