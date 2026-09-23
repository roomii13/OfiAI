/**
 * @archivo IntakeScreen.test.tsx
 * @descripcion Pruebas nativas de componentes con Expo; no sustituyen pruebas en dispositivo.
 */
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { IntakeScreen } from './IntakeScreen';
import { request, apiMobile } from '../lib/api';
import type { IntakeSession } from '../../../shared/intake';

const mockIdentity = { usuario: { uid: 'user-company', rol: 'empresa' } };
const mockNavigate = jest.fn();
jest.mock('../context/AuthContext', () => ({ useAuthMobile: () => mockIdentity }));
jest.mock('../lib/api', () => ({ request: jest.fn(), apiMobile: { get: jest.fn() } }));
jest.mock('../providers/theme', () => ({ useThemeMobile: () => ({
  modo: 'claro', colores: { fondo: '#fff', superficie: '#fff', texto: '#222', textoSuave: '#555', borde: '#ddd', primario: '#286589' },
}) }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]),
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));

let session: IntakeSession;
let failure = false;
const commands: Array<{ path: string; body: Record<string, unknown> }> = [];

/** Crea datos sinteticos para observar acciones de la pantalla sin Gemini ni Firestore. */
function fixture(): IntakeSession {
  return {
    id: 'native-session-123456', userId: 'user-company', companyId: 'company-a', schemaVersion: 1,
    version: 0, status: 'active', jobId: null, createdAt: '2026-09-23T00:00:00Z', updatedAt: '2026-09-23T00:00:00Z',
    message: 'Contame que necesita la empresa.', missingInformation: ['location'], readyToCreateJob: false, completionPercentage: 0,
    messages: [{ id: 'welcome', role: 'assistant', content: 'Contame que necesita la empresa.', createdAt: '2026-09-23T00:00:00Z' }],
    extractedData: { category: null, title: null, description: null, location: { country: null, city: null, region: null },
      urgency: null, preferredDate: null, budget: { min: null, max: null, currency: null }, budgetStatus: 'unknown',
      estimatedScope: null, requirements: [], attachmentsRequired: null, attachmentReason: null,
      multipleProfessionals: null, professionalTypes: [], workType: null },
  };
}

/** Completa el fixture sin simular que sea una respuesta de Google. */
function complete(): void {
  session = { ...session, readyToCreateJob: true, status: 'ready', version: session.version + 1, missingInformation: [], completionPercentage: 100,
    extractedData: { ...session.extractedData, title: 'Reparacion de fachada', category: 'Impermeabilizacion',
      description: 'Reparar la humedad de la fachada del edificio.', location: { country: 'Argentina', city: 'Santa Rosa', region: 'La Pampa' },
      urgency: 'high', preferredDate: 'La proxima semana', estimatedScope: '5 pisos / 18 departamentos', budgetStatus: 'to_quote', workType: 'presencial' } };
}

/** Envia un mensaje desde el campo y boton nativos. */
async function send(text: string): Promise<void> {
  fireEvent.changeText(screen.getByLabelText('Tu mensaje'), text);
  fireEvent.press(screen.getByLabelText('Enviar'));
  await waitFor(() => expect(screen.queryByText('La IA esta analizando...')).toBeNull());
}

beforeEach(() => {
  jest.clearAllMocks(); session = fixture(); failure = false; commands.length = 0;
  mockIdentity.usuario.rol = 'empresa';
  (apiMobile.get as jest.Mock).mockImplementation(async (path: string) => ({
    exito: true, datos: path === '/ai/intake/sessions'
      ? [{ id: session.id, title: 'Solicitud guardada', status: session.status, updatedAt: session.updatedAt }] : structuredClone(session),
  }));
  (request as jest.Mock).mockImplementation(async (path: string, options: RequestInit) => {
    const body = JSON.parse(String(options.body)) as Record<string, unknown>; commands.push({ path, body });
    if (path.endsWith('/messages')) {
      if (failure) throw new Error('La IA no esta disponible ahora.');
      complete();
    } else if (path.endsWith('/confirm')) {
      expect(body).toEqual({ confirmed: true, expectedVersion: session.version });
      session = { ...session, status: 'published', jobId: 'ai_' + session.id };
    }
    return { exito: true, datos: structuredClone(session) };
  });
});
afterEach(() => jest.restoreAllMocks());

it('inicia, muestra resumen y exige confirmar antes de publicar', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  render(<IntakeScreen />);
  fireEvent.press(screen.getByLabelText('Nueva'));
  await screen.findByText('Contame que necesita la empresa.');
  await send('Necesito reparar humedad de un edificio.');
  await screen.findByText('Santa Rosa, La Pampa, Argentina');
  expect(commands.some(command => command.path.endsWith('/confirm'))).toBe(false);
  fireEvent.press(screen.getByLabelText('Publicar solicitud'));
  expect(alert).toHaveBeenCalledTimes(1);
  expect(commands.some(command => command.path.endsWith('/confirm'))).toBe(false);
  const approve = alert.mock.calls[0][2]?.find(button => button.text === 'Publicar')?.onPress;
  await act(async () => { approve?.(); });
  await screen.findByText('Solicitud publicada');
  expect(commands.filter(command => command.path.endsWith('/confirm'))).toHaveLength(1);
  fireEvent.press(screen.getByLabelText('Ver mis trabajos'));
  expect(mockNavigate).toHaveBeenCalledWith('Trabajos');
});

it('conserva borrador y clave de reintento ante un error', async () => {
  render(<IntakeScreen />);
  fireEvent.press(screen.getByLabelText('Nueva'));
  await screen.findByText('Contame que necesita la empresa.');
  failure = true; await send('Necesito un electricista.');
  await screen.findByText('La IA no esta disponible ahora.');
  expect(screen.getByLabelText('Tu mensaje').props.value).toBe('Necesito un electricista.');
  failure = false; await send('Necesito un electricista.');
  await screen.findByLabelText('Publicar solicitud');
  const messages = commands.filter(command => command.path.endsWith('/messages'));
  expect(messages[0].body.requestId).toBe(messages[1].body.requestId);
  expect(screen.getByLabelText('Tu mensaje').props.value).toBe('');
});

it('recupera una conversacion del historial sin crear otra', async () => {
  render(<IntakeScreen />);
  fireEvent.press(screen.getByLabelText('Conversaciones'));
  fireEvent.press(await screen.findByText('Solicitud guardada'));
  await screen.findByText('Contame que necesita la empresa.');
  expect(apiMobile.get).toHaveBeenCalledWith('/ai/intake/sessions/' + session.id);
  expect(commands).toHaveLength(0);
});

it('no habilita el agente a profesionales', () => {
  mockIdentity.usuario.rol = 'profesional';
  render(<IntakeScreen />);
  expect(screen.getByText('Esta funcion esta disponible para empresas.')).toBeTruthy();
  expect(screen.queryByLabelText('Enviar')).toBeNull();
  expect(apiMobile.get).not.toHaveBeenCalled();
});

