/** @archivo JobCoordinatorScreen.test.tsx @descripcion Integracion nativa del acuerdo con respuestas HTTP simuladas. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { JobCoordinatorScreen } from './JobCoordinatorScreen';
import { request } from '../lib/api';
import type { CoordinatorCommand, CoordinatorStart, CoordinatorView } from '../../../shared/coordinator';

const mockIdentity = { usuario: { uid: 'company-user', rol: 'empresa' } };
const mockNavigate = jest.fn();
jest.mock('../context/AuthContext', () => ({ useAuthMobile: () => mockIdentity }));
jest.mock('../lib/api', () => ({ request: jest.fn() }));
jest.mock('../providers/theme', () => ({ useThemeMobile: () => ({
  colores: { fondo: '#fff', superficie: '#fff', texto: '#222', textoSuave: '#555', borde: '#ddd', primario: '#286589' },
}) }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }), useIsFocused: () => true, useRoute: () => ({ params: { jobId: 'job-ui' } }),
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'b22cbd89-a01d-4343-9847-018d9e94a175' }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

let view: CoordinatorView;
let failPost = false;
const posts: Array<{ path: string; body: CoordinatorCommand | CoordinatorStart }> = [];

/** Job y workflow sinteticos para UI, nunca persistidos fuera de Jest. */
function fixture(role: 'empresa' | 'profesional' = 'empresa'): CoordinatorView {
  return {
    role, job: { id: 'job-ui', title: 'Reparacion del tablero', description: 'Revisar instalaciones del edificio.',
      category: 'Electricidad', location: { city: 'Santa Rosa', province: 'La Pampa', country: 'AR' }, urgency: 'normal',
      preferredDate: null, budget: { min: null, max: null, currency: 'ARS' }, requirements: [],
      estimatedScope: 'Revision del tablero', workType: 'presencial', status: 'publicado' },
    workflow: { id: 'workflow-ui', jobId: 'job-ui', companyId: 'company', professionalId: 'professional',
      professionalName: 'Profesional de prueba', state: 'PROFESSIONAL_SELECTED', revision: 3,
      matchingRunId: 'matching-ui', pricingEstimateId: 'pricing-ui', pricingInsufficient: true,
      offer: null, schedule: null, completionRequested: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    advice: { actions: ['contact', 'cancel'], waitingFor: 'empresa', message: 'Confirma el contacto interno.' },
    history: [],
  };
}

beforeEach(() => {
  jest.clearAllMocks(); mockIdentity.usuario.rol = 'empresa'; view = fixture(); failPost = false; posts.length = 0;
  (request as jest.Mock).mockImplementation(async (path: string, init: RequestInit) => {
    if (init.method === 'POST') {
      posts.push({ path, body: JSON.parse(String(init.body)) as CoordinatorCommand | CoordinatorStart });
      if (failPost) throw new Error('La conexion se interrumpio.');
      if (view.workflow) view = { ...view, workflow: { ...view.workflow, revision: view.workflow.revision + 1 } };
    }
    return { exito: true, datos: structuredClone(view) };
  });
});

it('muestra el Job real y no envia una accion antes del consentimiento', async () => {
  render(<JobCoordinatorScreen />);
  await screen.findByText('Confirma el contacto interno.');
  expect(posts).toHaveLength(0);
  fireEvent.press(screen.getByLabelText('Contactar profesional'));
  expect(posts).toHaveLength(0);
  fireEvent(screen.getByLabelText('Confirmo expresamente esta accion y sus condiciones.'), 'valueChange', true);
  fireEvent.press(screen.getByLabelText('Confirmar y enviar'));
  await waitFor(() => expect(posts).toHaveLength(1));
  expect(posts[0].path).toBe('/jobs/job-ui/coordinator/commands');
  expect(posts[0].body).toMatchObject({ action: 'contact', workflowId: 'workflow-ui', revision: 3 });
});

it('reintenta exactamente la misma operacion tras una respuesta incierta', async () => {
  failPost = true; render(<JobCoordinatorScreen />);
  await screen.findByText('Confirma el contacto interno.');
  fireEvent.press(screen.getByLabelText('Contactar profesional'));
  fireEvent(screen.getByLabelText('Confirmo expresamente esta accion y sus condiciones.'), 'valueChange', true);
  fireEvent.press(screen.getByLabelText('Confirmar y enviar'));
  await waitFor(() => expect(posts).toHaveLength(1));
  await waitFor(() => expect(screen.queryByLabelText('Enviando accion')).toBeNull());
  failPost = false;
  fireEvent.press(screen.getByLabelText('Cerrar'));
  fireEvent.press(screen.getByLabelText('Reintentar envio'));
  fireEvent(screen.getByLabelText('Confirmo expresamente esta accion y sus condiciones.'), 'valueChange', true);
  fireEvent.press(screen.getByLabelText('Confirmar reintento'));
  await waitFor(() => expect(posts).toHaveLength(2));
  expect(posts[1]).toEqual(posts[0]);
});

it('no ofrece iniciar al profesional cuando falta un workflow', async () => {
  mockIdentity.usuario.rol = 'profesional'; view = fixture('profesional'); view.workflow = null;
  view.advice = { actions: [], waitingFor: 'empresa', message: 'La empresa debe iniciar la coordinacion.' };
  render(<JobCoordinatorScreen />);
  await screen.findByText('La empresa debe iniciar la coordinacion.');
  expect(screen.queryByLabelText('Iniciar coordinacion')).toBeNull();
  expect(posts).toHaveLength(0);
});

it('admite reiniciar solo una coordinacion cancelada con Job publicado', async () => {
  view.workflow!.state = 'CANCELLED'; view.advice.actions = [];
  render(<JobCoordinatorScreen />);
  await screen.findByText('Cancelado');
  expect(screen.getByLabelText('Reiniciar coordinacion')).toBeTruthy();
});
