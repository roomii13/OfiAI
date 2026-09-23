/** @archivo JobPricingScreen.test.tsx @descripcion Flujo nativo mediante componentes reales y transporte simulado. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { JobPricingScreen } from './JobPricingScreen';
import { request } from '../lib/api';
import type { PricingView } from '../../../shared/pricing';
const mockIdentity = { usuario: { uid: 'user-company', rol: 'empresa' } };
const mockNavigate = jest.fn();
jest.mock('../context/AuthContext', () => ({ useAuthMobile: () => mockIdentity }));
jest.mock('../lib/api', () => ({ request: jest.fn() }));
jest.mock('../providers/theme', () => ({ useThemeMobile: () => ({
  modo: 'claro', colores: { fondo: '#fff', superficie: '#fff', texto: '#222', textoSuave: '#555', borde: '#ddd', primario: '#286589' },
}) }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }), useIsFocused: () => true, useRoute: () => ({ params: { jobId: 'job-ui' } }),
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
let view: PricingView; let failure: boolean; const paths: string[] = [];
/** Datos sinteticos para UI; no se escriben en Firestore. */
function fixture(): PricingView {
  return { jobId: 'job-ui', job: { id: 'job-ui', title: 'Reparacion del tablero', description: 'Revisar instalaciones del edificio.',
    category: 'Electricidad', location: { city: 'Santa Rosa', province: 'La Pampa', country: 'AR' }, urgency: 'normal',
    preferredDate: 'Proxima semana', budget: { min: null, max: null, currency: 'ARS' }, requirements: ['Tableros'],
    estimatedScope: 'Revision del tablero', workType: 'presencial', status: 'publicado' },
    inputs: { scope: 'Revision del tablero', currency: 'ARS', unit: 'hour', quantity: 4,
      materials: 'excluded', taxes: 'excluded', materialsCost: null, requiredExperienceYears: 2 },
    revision: 1, quotes: [], processing: false, stale: false, history: [], nextStep: 'professional_selection',
    result: { id: 'estimate-ui', version: '1.0.0', generatedAt: new Date().toISOString(), expiresAt: '2099-01-01',
      status: 'estimated', currency: 'ARS', range: { min: 10000, max: 14000, central: 12000 }, basis: 'quote',
      confidence: 60, confidenceLevel: 'medium', missingInformation: [], factors: ['Categoria: Electricidad'],
      warnings: ['Materiales excluidos.'], evidenceCount: 2, comparisons: [], semanticUsed: false, fallbackUsed: true,
      analysis: null, assumptions: ['Sin conversion de moneda.'], evidence: [] } };
}

beforeEach(() => {
  jest.clearAllMocks(); view = fixture(); failure = false; paths.length = 0; mockIdentity.usuario.rol = 'empresa';
  (request as jest.Mock).mockImplementation(async (path: string, init: RequestInit) => {
    paths.push((init.method ?? 'GET') + ' ' + path);
    if (failure) throw new Error('No se pudo conectar.');
    if (path.endsWith('/inputs')) {
      const body = JSON.parse(String(init.body)); expect(body.revision).toBe(view.revision);
      view = { ...view, inputs: body.inputs, revision: view.revision + 1, stale: true };
    } else if (path.endsWith('/quotes')) {
      const body = JSON.parse(String(init.body)); expect(body.revision).toBe(view.revision);
      view = { ...view, quotes: [...view.quotes, body.quote], revision: view.revision + 1, stale: true };
    } else if (init.method === 'POST') view = { ...view, stale: false };
    return { exito: true, datos: structuredClone(view) };
  });
});
it('muestra rango desde cache y navega hacia los candidatos', async () => {
  render(<JobPricingScreen />); await screen.findByText('10.000 ARS a 14.000 ARS');
  expect(paths.filter(p => p.startsWith('POST'))).toHaveLength(0);
  fireEvent.press(screen.getByLabelText('Profesionales')); expect(mockNavigate).toHaveBeenCalledWith('JobMatches', { jobId: 'job-ui' });
});
it('edita el alcance y persiste presupuesto solo despues de confirmacion', async () => {
  render(<JobPricingScreen />); await screen.findByText('10.000 ARS a 14.000 ARS');
  fireEvent.press(screen.getByLabelText('Editar alcance y condiciones'));
  fireEvent.changeText(screen.getByLabelText('Cantidad'), '8'); fireEvent.press(screen.getByLabelText('Guardar y estimar'));
  await waitFor(() => expect(view.inputs?.quantity).toBe(8));
  await waitFor(() => expect(screen.queryByLabelText('Guardar y estimar')).toBeNull());
  fireEvent.press(screen.getByLabelText('Agregar presupuesto recibido'));
  fireEvent.changeText(screen.getByLabelText('Referencia del presupuesto'), 'Presupuesto recibido A');
  fireEvent.changeText(screen.getByLabelText('Importe total'), '20000');
  fireEvent.changeText(screen.getByLabelText('Valido hasta (AAAA-MM-DD)'), '2026-10-01');
  expect(view.quotes).toHaveLength(0); fireEvent.press(screen.getByLabelText('Registrar presupuesto'));
  await waitFor(() => expect(view.quotes).toHaveLength(1));
});
it('muestra errores dentro del formulario y permite reintentar', async () => {
  render(<JobPricingScreen />); await screen.findByText('10.000 ARS a 14.000 ARS');
  fireEvent.press(screen.getByLabelText('Editar alcance y condiciones')); failure = true;
  fireEvent.press(screen.getByLabelText('Guardar y estimar')); await screen.findAllByText('No se pudo conectar.');
  expect(view.revision).toBe(1); failure = false; fireEvent.press(screen.getByLabelText('Guardar y estimar'));
  await waitFor(() => expect(view.revision).toBe(2));
});
it('no muestra pricing sin rol empresa', () => {
  mockIdentity.usuario.rol = 'profesional'; render(<JobPricingScreen />);
  expect(screen.getByText('Esta funcion esta disponible para empresas.')).toBeTruthy(); expect(request).not.toHaveBeenCalled();
});
