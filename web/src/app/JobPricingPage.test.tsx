/** @archivo JobPricingPage.test.tsx @descripcion Flujo web real con API controlada, sin precios de produccion. */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AppRouter } from './Router';
import { setAuthToken } from '../lib/api/client';
import type { PricingView } from '../../../shared/pricing';
const auth = vi.hoisted(() => ({ user: { id: 'company-user', name: 'Empresa', email: 'test@example.test', role: 'empresa' },
  role: 'empresa', loading: false, isAuthenticated: true, token: 'test-token', logout: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../lib/firebase', () => ({ auth: null }));
vi.mock('../lib/config', () => ({ configuracion: { api: { baseUrl: 'https://api.example.test/api/v1' } } }));
const fetchMock = vi.fn<typeof fetch>();
let view: PricingView; let failure: boolean;
const paths: string[] = [];
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

/** Monta la ruta protegida con StrictMode para comprobar cancelacion. */
function open() { return render(<StrictMode><MemoryRouter initialEntries={['/dashboard/company/jobs/job-ui/pricing']}><AppRouter /></MemoryRouter></StrictMode>); }
beforeEach(() => {
  view = fixture(); failure = false; paths.length = 0; auth.role = 'empresa'; auth.user.role = 'empresa'; setAuthToken('test-token');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset().mockImplementation(async (input, init = {}) => {
    const path = new URL(String(input)).pathname.replace('/api/v1', ''); paths.push((init.method ?? 'GET') + ' ' + path);
    if (failure && path.includes('/pricing')) return new Response(JSON.stringify({ mensaje: 'No se pudo conectar.' }), { status: 503 });
    let data: unknown = view;
    if (path === '/jobs' || path === '/notifications') data = [];
    else if (path.startsWith('/dashboard/') || path === '/subscriptions/me') data = null;
    else if (path.endsWith('/inputs')) {
      const body = JSON.parse(String(init.body)); expect(body.revision).toBe(view.revision);
      view = { ...view, inputs: body.inputs, revision: view.revision + 1, stale: true, result: null }; data = view;
    } else if (path.endsWith('/quotes')) {
      const body = JSON.parse(String(init.body)); expect(body.revision).toBe(view.revision);
      view = { ...view, quotes: [...view.quotes, body.quote], revision: view.revision + 1, stale: true }; data = view;
    } else if (path.endsWith('/pricing') && init.method === 'POST') { view = { ...view, stale: false, result: fixture().result }; data = view; }
    return new Response(JSON.stringify({ exito: true, datos: data }));
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('muestra rango y advertencias desde cache sin volver a usar IA', async () => {
  open(); await screen.findByText('10.000 ARS a 14.000 ARS');
  expect(screen.getByText('Materiales excluidos.')).toBeTruthy();
  expect(paths.filter(p => p === 'POST /jobs/job-ui/pricing')).toHaveLength(0);
});
it('guarda alcance con revision y recalcula; registra un presupuesto solo al confirmar', async () => {
  open(); await screen.findByText('10.000 ARS a 14.000 ARS');
  fireEvent.click(screen.getByText('Alcance y condiciones'));
  fireEvent.change(screen.getAllByLabelText('Cantidad')[0], { target: { value: '8' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y estimar' }));
  await screen.findByText('Alcance guardado y estimacion actualizada.');
  expect(view.inputs?.quantity).toBe(8);
  fireEvent.click(screen.getByText('Agregar presupuesto recibido'));
  fireEvent.change(screen.getByLabelText('Referencia del presupuesto'), { target: { value: 'Cotizacion recibida A' } });
  fireEvent.change(screen.getByLabelText('Importe total'), { target: { value: '20000' } });
  fireEvent.change(screen.getByLabelText('Valido hasta'), { target: { value: '2026-10-01' } });
  expect(view.quotes).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Registrar presupuesto' }));
  await screen.findByText('Presupuesto guardado.'); expect(view.quotes).toHaveLength(1);
  expect(paths.filter(p => p === 'POST /jobs/job-ui/pricing')).toHaveLength(2);
});
it('maneja informacion insuficiente y error recuperable sin crear datos de reemplazo', async () => {
  view.result = { ...view.result!, range: null, status: 'insufficient_data', confidence: 0, missingInformation: ['Falta alcance confirmado'] };
  open(); await screen.findByText('Faltan referencias comparables');
  failure = true; fireEvent.click(screen.getByRole('button', { name: 'Actualizar estimacion' }));
  await screen.findByRole('alert'); failure = false;
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
});
it('niega la pantalla a un profesional', async () => {
  auth.role = 'profesional'; auth.user.role = 'profesional'; open();
  await waitFor(() => expect(paths.some(p => p.includes('/pricing'))).toBe(false));
});
