/**
 * @archivo health.test.ts
 * @descripcion Prueba de API para validar que el router Express responde health checks.
 */
import type { Server } from 'http';
import type { Application } from 'express';

jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

let app: Application;
let server: Server | null = null;
let baseUrl = '';

/**
 * Inicia Express en un puerto efímero para pruebas HTTP reales.
 */
function startServer(): Promise<void> {
  return new Promise(resolve => {
    server = app.listen(0, () => {
      const address = server?.address();

      if (!address || typeof address === 'string') {
        throw new Error('No fue posible obtener el puerto de prueba.');
      }

      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
}

/**
 * Cierra el servidor HTTP iniciado por la prueba.
 */
function stopServer(): Promise<void> {
  const activeServer = server;

  if (!activeServer) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    activeServer.close(error => {
      if (error) {
        reject(error);
        return;
      }

      server = null;
      resolve();
    });
  });
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.TRUST_PROXY_HOPS = '1';
  process.env.JWT_SECRET = 'ofiai-test-jwt-secret-key-2026';
  process.env.MERCADOPAGO_NOTIFICATION_URL = 'https://ofiai.local/webhooks/mercadopago';
  const appModule = await import('../../src/app');
  app = appModule.default;
  app.get('/__test/client-ip', (req, res) => { res.json({ ip: req.ip }); });
  await startServer();
});

afterAll(async () => {
  await stopServer();
});

describe('GET /api/v1/health/liveness', () => {
  it('confia en un solo proxy y no en el primer valor arbitrario de X-Forwarded-For', async () => {
    expect(app.get('trust proxy')).toBe(1);
    const response = await fetch(`${baseUrl}/__test/client-ip`, {
      headers: { 'X-Forwarded-For': '198.51.100.99, 203.0.113.10' },
    });
    expect(await response.json()).toEqual({ ip: '203.0.113.10' });
  });
  it('responde estado operacional y metadatos básicos', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/liveness`);
    const body = await response.json() as {
      estado: string;
      servicio: string;
      version: string;
      timestamp: string;
    };

    expect(response.status).toBe(200);
    expect(body.estado).toBe('operacional');
    expect(body.servicio).toBe('OfiAI Backend');
    expect(body.version).toBeTruthy();
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });
});
