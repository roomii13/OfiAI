/**
 * @archivo health.test.ts
 * @descripcion Prueba de API para validar que el router Express responde health checks.
 */
import type { Server } from 'http';
import type { Application } from 'express';

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
  process.env.JWT_SECRET = 'ofiai-test-jwt-secret-key-2026';
  process.env.MERCADOPAGO_NOTIFICATION_URL = 'https://ofiai.local/webhooks/mercadopago';
  const appModule = await import('../../src/app');
  app = appModule.default;
  await startServer();
});

afterAll(async () => {
  await stopServer();
});

describe('GET /api/v1/health/liveness', () => {
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
