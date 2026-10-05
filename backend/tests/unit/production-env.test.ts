/** @archivo production-env.test.ts @descripcion Valida el entorno de alojamiento sin leer secretos locales. */
import type { EnvConfig } from '../../src/config/env';

jest.mock('dotenv', () => ({ config: jest.fn() }));
const originalEnvironment = { ...process.env };

/** Carga la configuracion con credenciales ficticias en un modulo aislado. */
function loadEnvironment(overrides: NodeJS.ProcessEnv = {}): EnvConfig {
  process.env = {
    NODE_ENV: 'production', FIREBASE_PROJECT_ID: 'ofiai-env-test',
    FIREBASE_API_KEY: 'test-only', FIREBASE_PRIVATE_KEY: 'test-only',
    FIREBASE_CLIENT_EMAIL: 'test@example.test', FIREBASE_STORAGE_BUCKET: 'example.test',
    GROQ_API_KEY: 'test-only', GOOGLE_MAPS_API_KEY: 'test-only',
    MERCADOPAGO_ACCESS_TOKEN: 'test-only', MERCADOPAGO_WEBHOOK_SECRET: 'test-only',
    MERCADOPAGO_NOTIFICATION_URL: 'https://example.test/webhook',
    RESEND_API_KEY: 'test-only', RESEND_FROM_EMAIL: 'test@example.test',
    JWT_SECRET: 'test-only-production-environment-validation',
    CORS_ORIGINS: 'https://example.test', ...overrides,
  };
  let result: EnvConfig | undefined;
  jest.isolateModules(() => {
    result = (jest.requireActual('../../src/config/env') as { env: EnvConfig }).env;
  });
  if (!result) throw new Error('No se cargo el entorno de prueba.');
  return result;
}

beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => undefined); });
afterEach(() => { process.env = { ...originalEnvironment }; jest.restoreAllMocks(); });

describe('Configuracion para Render', () => {
  it('permite WhatsApp deshabilitado sin bloquear el resto de la API', () => {
    expect(loadEnvironment().WHATSAPP_TOKEN).toBe('');
  });
  it('conserva WhatsApp cuando ambas credenciales estan configuradas', () => {
    expect(loadEnvironment({ WHATSAPP_TOKEN: 'test-only', WHATSAPP_PHONE_ID: '123456789012' }).WHATSAPP_PHONE_ID)
      .toBe('123456789012');
  });
  it.each([
    { WHATSAPP_TOKEN: 'test-only' },
    { WHATSAPP_PHONE_ID: '123456789012' },
    { WHATSAPP_TOKEN: 'test-only', WHATSAPP_PHONE_ID: 'tu_phone_id' },
  ])('rechaza credenciales de WhatsApp incompletas o de ejemplo: %j', overrides => {
    expect(() => loadEnvironment(overrides)).toThrow('Configuraci');
  });
  it('no confia en proxies por defecto', () => {
    expect(loadEnvironment().TRUST_PROXY_HOPS).toBe(0);
  });
  it('permite un proxy explicitamente configurado', () => {
    expect(loadEnvironment({ TRUST_PROXY_HOPS: '1' }).TRUST_PROXY_HOPS).toBe(1);
  });
  it.each(['true', '-1', '1.5', '99'])('rechaza TRUST_PROXY_HOPS=%s', value => {
    expect(() => loadEnvironment({ TRUST_PROXY_HOPS: value })).toThrow('Configuraci');
  });
  it('sigue rechazando la falta de credenciales criticas', () => {
    expect(() => loadEnvironment({ FIREBASE_PRIVATE_KEY: '' })).toThrow('Configuraci');
  });
});
