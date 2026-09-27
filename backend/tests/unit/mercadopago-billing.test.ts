/** @archivo mercadopago-billing.test.ts @descripcion Firma real y contrato HTTP recurrente, con transporte aislado. */
import { createHmac } from 'node:crypto';
import { env } from '../../src/config/env';
import { crearPreapprovalMercadoPago, obtenerFacturaMercadoPago, validarFirmaMercadoPago } from '../../src/integrations/mercadopago';
afterEach(() => jest.restoreAllMocks());
it('exige secreto, HMAC valido y normaliza el identificador segun Mercado Pago', () => {
  env.MERCADOPAGO_WEBHOOK_SECRET = '';
  expect(validarFirmaMercadoPago(undefined, undefined, 'abc')).toBe(false);
  env.MERCADOPAGO_WEBHOOK_SECRET = 'unit-test-only';
  const ts = '1704908010';
  const hash = createHmac('sha256', env.MERCADOPAGO_WEBHOOK_SECRET).update('id:abc;request-id:req-1;ts:' + ts + ';').digest('hex');
  expect(validarFirmaMercadoPago('ts=' + ts + ',v1=' + hash, 'req-1', 'ABC')).toBe(true);
  expect(validarFirmaMercadoPago('ts=' + ts + ',v1=' + hash, 'req-1', 'other')).toBe(false);
  expect(validarFirmaMercadoPago('ts=no,v1=' + hash, 'req-1', 'ABC')).toBe(false);
});
it('crea contratos de renovacion automatica mensual en estado pendiente', async () => {
  env.MERCADOPAGO_ACCESS_TOKEN = 'unit-test-only';
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'pre-1', init_point: 'https://www.mercadopago.com.ar/checkout' })));
  await crearPreapprovalMercadoPago({ payerEmail: 'test@example.test', reason: 'PRO', amount: 35000, currency: 'ARS',
    backUrl: 'https://ofiai.example/subscriptions/success', usuarioId: 'uid-1', suscripcionId: 'sub-1', plan: 'profesional' });
  const body = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body));
  expect(body).toMatchObject({ status: 'pending', external_reference: 'sub-1',
    auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: 35000, currency_id: 'ARS' } });
});
it('facturas y pagos tienen endpoints diferentes y rechaza rutas inyectadas', async () => {
  env.MERCADOPAGO_ACCESS_TOKEN = 'unit-test-only';
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    id: 123, preapproval_id: 'pre-1', debit_date: '2026-09-26T12:00:00Z', currency_id: 'ARS', transaction_amount: '35000.00',
  })));
  await obtenerFacturaMercadoPago('123');
  expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.mercadopago.com/authorized_payments/123');
  await expect(obtenerFacturaMercadoPago('../payments')).rejects.toThrow();
});
