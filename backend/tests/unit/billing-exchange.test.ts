/** @archivo billing-exchange.test.ts @descripcion Cotizacion real del adaptador con transporte aislado, cache y fallos seguros. */
import { env } from '../../src/config/env';
import { BillingExchangeService } from '../../src/services/billing-exchange.service';
import { obtenerCotizacionMercadoPago } from '../../src/integrations/mercadopago';

const now = new Date('2026-10-05T12:00:00Z');
const quote = { currency_base: 'USD', currency_quote: 'ARS', rate: 1000, creation_date: now.toISOString() };
let fetchMock: jest.SpiedFunction<typeof fetch>;
beforeEach(() => {
  jest.useFakeTimers({ now });
  Object.assign(env, { BILLING_USD_TO_ARS: undefined, MERCADOPAGO_CURRENCY: 'ARS',
    MERCADOPAGO_PUBLIC_KEY: 'unit-test-public', MERCADOPAGO_ACCESS_TOKEN: 'unit-test-only' });
  fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(JSON.stringify(quote)));
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

it('consulta la API oficial autenticada sin enviar datos de usuarios ni crear pagos', async () => {
  expect(await obtenerCotizacionMercadoPago()).toEqual({ rate: 1000, asOf: now.toISOString() });
  const [target, options] = fetchMock.mock.calls[0]!;
  const url = new URL(String(target));
  expect(url.origin).toBe('https://api.mercadopago.com');
  expect(url.pathname).toBe('/v1/exchange_rates');
  expect(url.searchParams.get('from')).toBe('USD');
  expect(url.searchParams.get('to')).toBe('ARS');
  expect(options).toMatchObject({ method: 'GET', redirect: 'error', headers: { Authorization: 'Bearer unit-test-only' } });
  expect(options?.body).toBeUndefined();
});
it('comparte solicitudes concurrentes y renueva la cache despues de una hora', async () => {
  const service = new BillingExchangeService();
  const results = await Promise.all([service.get(), service.get(), service.get()]);
  expect(results[0]).toMatchObject({ source: 'mercadopago', rate: 1000, base: 'USD', quote: 'ARS' });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await service.get(); expect(fetchMock).toHaveBeenCalledTimes(1);
  jest.setSystemTime(new Date(now.getTime() + 3600001));
  await service.get(); expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('mantiene la conversion manual existente sin consultar al proveedor', async () => {
  env.BILLING_USD_TO_ARS = 1200;
  expect(await new BillingExchangeService().get()).toMatchObject({ source: 'manual', rate: 1200 });
  expect(fetchMock).not.toHaveBeenCalled();
});
it('sin credenciales no realiza consultas ni inventa una cotizacion', async () => {
  env.MERCADOPAGO_PUBLIC_KEY = '';
  expect(await new BillingExchangeService().get()).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});
it('no aplica una cotizacion ARS a una moneda distinta', async () => {
  env.MERCADOPAGO_CURRENCY = 'USD';
  expect(await new BillingExchangeService().get()).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});
it.each([
  { currency_quote: 'BRL' }, { currency_base: 'EUR' }, { rate: 0 }, { rate: -1 }, { rate: '1000' },
  { rate: 1000001 }, { creation_date: 'no-date' }, { creation_date: '2026-09-01T12:00:00Z' },
  { creation_date: '2026-10-07T12:00:00Z' },
])('rechaza cotizaciones invalidas o vencidas: %j', async patch => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ...quote, ...patch })));
  expect(await new BillingExchangeService().get()).toBeNull();
});
it('un timeout se controla y aplica backoff sin exponer el error interno', async () => {
  const service = new BillingExchangeService();
  fetchMock.mockRejectedValueOnce(new Error('internal-timeout'));
  expect(await service.get()).toBeNull();
  expect(await service.get()).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  jest.setSystemTime(new Date(now.getTime() + 60001));
  expect(await service.get()).toMatchObject({ rate: 1000 });
});
it.each([401, 429, 500])('controla HTTP %s sin habilitar un precio', async status => {
  fetchMock.mockResolvedValueOnce(new Response('{}', { status }));
  expect(await new BillingExchangeService().get()).toBeNull();
});
it('rechaza JSON invalido y no reutiliza una cache vencida cuando el proveedor falla', async () => {
  const service = new BillingExchangeService();
  await service.get();
  jest.setSystemTime(new Date(now.getTime() + 3600001));
  fetchMock.mockResolvedValueOnce(new Response('{invalid-json'));
  expect(await service.get()).toBeNull();
});
