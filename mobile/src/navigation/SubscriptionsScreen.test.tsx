/** @archivo SubscriptionsScreen.test.tsx @descripcion Facturacion nativa con respuestas aisladas y consentimiento explicito. */
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SubscriptionsScreen } from './SubscriptionsScreen';
import { apiMobile } from '../lib/api';
jest.mock('../context/AuthContext', () => ({ useAuthMobile: () => ({ usuario: { uid: 'user-test', rol: 'empresa' } }) }));
jest.mock('../lib/api', () => ({ apiMobile: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../providers/theme', () => ({ useThemeMobile: () => ({ colores: {
  fondo: '#fff', texto: '#222', textoSuave: '#555', borde: '#ddd', primario: '#286589',
} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
const plan = { id: 'empresa', nombre: 'BUSINESS', audience: 'empresa', priceUsd: 35, limits: { trabajosPublicados: 10 } };
beforeEach(() => {
  jest.clearAllMocks();
  (apiMobile.get as jest.Mock).mockImplementation(async (path: string) => ({ exito: true, datos: path.includes('/plans') ? [plan]
    : path.endsWith('/me') ? { id: 'sub-1', plan: 'empresa', estado: 'activa', renovacionAutomatica: true }
      : { pendingCheckout: null, payments: [], entitlements: { plan: 'empresa', period: '2026-09',
        limits: { trabajosPublicados: 10, propuestasEnviadas: 0 }, used: { trabajosPublicados: 2 } } } }));
  (apiMobile.post as jest.Mock).mockResolvedValue({ exito: true });
});
afterEach(() => jest.restoreAllMocks());
it('muestra consumo y precios reales, sin lanzar checkout de Mercado Pago desde la tienda', async () => {
  render(<SubscriptionsScreen />);
  await screen.findByText('US$ 35 /mes');
  expect(screen.getByText('Trabajos Publicados: 2 / 10')).toBeTruthy();
  expect(screen.getByText(/aun no disponibles/)).toBeTruthy();
  expect(apiMobile.post).not.toHaveBeenCalled();
});
it('requiere confirmacion nativa para cancelar y conserva el periodo pagado', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  render(<SubscriptionsScreen />);
  fireEvent.press(await screen.findByRole('button', { name: 'Cancelar renovacion' }));
  expect(apiMobile.post).not.toHaveBeenCalled();
  const confirm = alert.mock.calls[0]?.[2]?.find(button => button.style === 'destructive');
  confirm?.onPress?.();
  await waitFor(() => expect(apiMobile.post).toHaveBeenCalledWith('/subscriptions/sub-1/cancel', { cancelarAlFinalDelPeriodo: true }));
});
it('no presenta un plan FREE inventado cuando falla la API', async () => {
  (apiMobile.get as jest.Mock).mockRejectedValue(new Error('No se pudo conectar.'));
  render(<SubscriptionsScreen />);
  await screen.findByText('No se pudo conectar.');
  expect(screen.queryByText('FREE')).toBeNull();
  expect(screen.getByText('Plan no disponible')).toBeTruthy();
});
