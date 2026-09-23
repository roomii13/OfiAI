/**
 * @archivo JobMatchesScreen.test.tsx
 * @descripcion Interacciones nativas; no equivalen a pruebas en un telefono fisico.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { JobMatchesScreen } from './JobMatchesScreen';
import { request } from '../lib/api';
import type { MatchingResult, ProfessionalMatch } from '../../../shared/matching';
const mockIdentity = { usuario: { uid: 'user-company', rol: 'empresa' } };
const mockNavigate = jest.fn();
jest.mock('../context/AuthContext', () => ({ useAuthMobile: () => mockIdentity }));
jest.mock('../lib/api', () => ({ request: jest.fn() }));
jest.mock('../providers/theme', () => ({ useThemeMobile: () => ({
  modo: 'claro', colores: { fondo: '#fff', superficie: '#fff', texto: '#222', textoSuave: '#555', borde: '#ddd', primario: '#286589' },
}) }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }), useIsFocused: () => true,
  useRoute: () => ({ params: { jobId: 'job-ui' } }),
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
let result: MatchingResult; let failure: boolean; let pending: boolean;
const paths: string[] = [];
/** Recomendaciones sinteticas para pruebas de interfaz, nunca datos del catalogo real. */
function fixture(): MatchingResult {
  const professionals: ProfessionalMatch[] = [0, 1].map(index => ({
    professionalId: 'pro-' + index, matchScore: index ? 76 : 94, deterministicScore: index ? 76 : 94,
    semanticScore: null, distanceKm: index ? 35 : 3, reason: 'Habilidades y categoria compatibles con la solicitud.',
    strengths: ['Coincide con la categoria'], concerns: ['Fecha por confirmar'], recommended: true,
    state: 'recommended', generatedAt: '2026-09-23T00:00:00Z',
    professional: { id: 'pro-' + index, firstName: index ? 'Bruno' : 'Ana', lastName: 'Prueba', profileImage: null,
      description: 'Instalaciones y reparaciones electricas.', categories: ['Electricidad'], skills: ['Tableros'],
      experienceYears: index ? 2 : 8, location: { country: 'AR', province: 'La Pampa', city: 'Santa Rosa' },
      available: !index, availabilityDays: ['lunes'], minimumPrice: index ? 20000 : 40000,
      hourlyRate: null, currency: 'ARS', verified: !index, rating: index ? 3 : 4.9, completedJobs: index ? 8 : 120, responseRate: null },
  }));
  return { jobId: 'job-ui', job: { id: 'job-ui', title: 'Reparacion electrica del edificio', description: 'Revisar tableros e instalaciones.',
    category: 'Electricidad', location: { city: 'Santa Rosa', province: 'La Pampa', country: 'AR' }, urgency: 'high',
    preferredDate: 'Proxima semana', budget: { min: null, max: null, currency: 'ARS' }, requirements: ['Tableros'],
    estimatedScope: 'Edificio de cinco pisos', workType: 'presencial', status: 'publicado' },
    runId: '38ed67b1-3866-4c6c-ac08-259fd7e5a03a', status: 'fallback', completedStages: 5,
    totalCandidates: 2, scannedCandidates: 12, searchLimited: false, matches: professionals,
    generatedAt: '2026-09-23T00:00:00Z', expiresAt: '2099-01-01T00:00:00Z', cached: true,
    fallbackUsed: true, semanticMatchingUsed: false, selectedProfessionalId: null,
    message: 'Recomendaciones generadas con criterios de compatibilidad.' };
}
beforeEach(() => {
  jest.clearAllMocks(); result = fixture(); failure = false; pending = false; paths.length = 0; mockIdentity.usuario.rol = 'empresa';
  (request as jest.Mock).mockImplementation(async (path: string, init: RequestInit) => {
    paths.push((init.method ?? 'GET') + ' ' + path);
    if (failure) throw new Error('No se pudo conectar.');
    let data: unknown = result;
    if (path.endsWith('/events')) data = null;
    else if (path.endsWith('/profile')) data = result.matches.find(row => path.includes(row.professionalId));
    else if (path.endsWith('/select')) {
      expect(JSON.parse(String(init.body))).toEqual({ runId: result.runId });
      const id = result.matches.find(row => path.includes(row.professionalId))!.professionalId;
      result = { ...result, selectedProfessionalId: id, matches: result.matches.map(row => ({ ...row, state: row.professionalId === id ? 'selected' : 'recommended' })) }; data = result;
    } else if (path.endsWith('/matching')) { pending = false; data = result; }
    else if (path.endsWith('/matches') && pending) data = { ...result, matches: [], status: 'pending', completedStages: 0 };
    return { exito: true, datos: structuredClone(data) };
  });
});
it('usa cache y filtra desde un panel movil sin repetir Gemini', async () => {
  render(<JobMatchesScreen />); await screen.findByText('Ana Prueba');
  fireEvent.press(screen.getByLabelText('Filtrar candidatos'));
  fireEvent.changeText(screen.getByLabelText('Distancia maxima (km)'), '10');
  fireEvent.press(screen.getByLabelText('Ver resultados'));
  expect(screen.queryByText('Bruno Prueba')).toBeNull();
  expect(paths.some(path => path.endsWith('/matching'))).toBe(false);
});
it('inicia, abre perfil y selecciona explicitamente sin contratar', async () => {
  pending = true; render(<JobMatchesScreen />); await screen.findByText('Ana Prueba');
  expect(paths.filter(path => path.endsWith('/matching'))).toHaveLength(1);
  expect(paths.some(path => path.endsWith('/select'))).toBe(false);
  fireEvent.press(screen.getAllByLabelText('Ver perfil')[0]);
  await screen.findByText('Instalaciones y reparaciones electricas.');
  failure = true;
  fireEvent.press(screen.getAllByLabelText('Seleccionar profesional').at(-1)!);
  await screen.findAllByText('No se pudo conectar.');
  expect(result.selectedProfessionalId).toBeNull();
  failure = false;
  fireEvent.press(screen.getAllByLabelText('Seleccionar profesional').at(-1)!);
  await screen.findAllByLabelText('Seleccionado');
  fireEvent.press(screen.getByLabelText('Cerrar'));
  await screen.findByText('Todavia no se realizo una contratacion.');
  expect(paths.filter(path => path.endsWith('/select'))).toHaveLength(2);
});
it('maneja errores y resultados vacios sin datos de reemplazo', async () => {
  failure = true; render(<JobMatchesScreen />);
  await screen.findByText('No se pudo conectar.');
  failure = false; result.matches = []; result.totalCandidates = 0;
  fireEvent.press(screen.getByLabelText('Reintentar'));
  await screen.findByText('Todavia no encontramos profesionales que cumplan todos los requisitos.');
  await waitFor(() => expect(screen.queryByText('No se pudo conectar.')).toBeNull());
});
it('restringe acceso por rol', () => {
  mockIdentity.usuario.rol = 'profesional'; render(<JobMatchesScreen />);
  expect(screen.getByText('Esta funcion esta disponible para empresas.')).toBeTruthy();
  expect(request).not.toHaveBeenCalled();
});
