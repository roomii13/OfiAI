/**
 * @archivo JobMatchesPage.test.tsx
 * @descripcion Flujo web con rutas reales y HTTP controlado.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRouter } from './Router';
import { setAuthToken } from '../lib/api/client';
import type { MatchingResult, ProfessionalMatch } from '../../../shared/matching';
const auth = vi.hoisted(() => ({ user: { id: 'company-user', name: 'Empresa', email: 'test@example.test', role: 'empresa' },
  role: 'empresa', loading: false, isAuthenticated: true, token: 'test-token', logout: vi.fn() }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../lib/firebase', () => ({ auth: null }));
vi.mock('../lib/config', () => ({ configuracion: { api: { baseUrl: 'https://api.example.test/api/v1' } } }));
const fetchMock = vi.fn<typeof fetch>();
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
/** Monta el router del producto. */
function open() { return render(<MemoryRouter initialEntries={['/dashboard/company/jobs/job-ui/matches']}><AppRouter /></MemoryRouter>); }
beforeEach(() => {
  result = fixture(); failure = false; pending = false; paths.length = 0;
  auth.role = 'empresa'; auth.user.role = 'empresa';
  setAuthToken('test-token');
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset().mockImplementation(async (input, init = {}) => {
    const path = new URL(String(input)).pathname.replace('/api/v1', '');
    paths.push((init.method ?? 'GET') + ' ' + path);
    if (path.startsWith('/dashboard/')) return new Response(JSON.stringify({ exito: true, datos: null }));
    if (failure && path.includes('/jobs/')) return new Response(JSON.stringify({ mensaje: 'No se pudo conectar.' }), { status: 503 });
    let data: unknown = result;
    if (path === '/jobs' || path === '/notifications') data = [];
    if (path === '/subscriptions/me') data = null;
    else if (path.endsWith('/events')) data = null;
    else if (path.endsWith('/profile')) data = result.matches.find(row => path.includes(row.professionalId));
    else if (path.endsWith('/select')) {
      expect(JSON.parse(String(init.body))).toEqual({ runId: result.runId });
      const id = result.matches.find(row => path.includes(row.professionalId))!.professionalId;
      result = { ...result, selectedProfessionalId: id, matches: result.matches.map(row => ({ ...row, state: row.professionalId === id ? 'selected' : 'recommended' })) }; data = result;
    } else if (path.endsWith('/matching')) { pending = false; data = result; }
    else if (path.endsWith('/matches') && pending) data = { ...result, matches: [], status: 'pending', completedStages: 0 };
    return new Response(JSON.stringify({ exito: true, datos: data }));
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('recupera cache, filtra y ordena sin ejecutar matching otra vez', async () => {
  open(); await screen.findByText('Ana Prueba'); await screen.findByText('Bruno Prueba');
  fireEvent.change(screen.getByLabelText('Distancia maxima (km)'), { target: { value: '10' } });
  expect(screen.queryByText('Bruno Prueba')).toBeNull();
  fireEvent.change(screen.getByLabelText('Ordenar'), { target: { value: 'rating' } });
  expect(paths.filter(path => path.endsWith('/matching'))).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
  expect(screen.getByText('Bruno Prueba')).toBeTruthy();
  expect(screen.getByText('Recomendaciones generadas con criterios de compatibilidad.')).toBeTruthy();
});
it('inicia solo al faltar cache y selecciona luego de abrir perfil publico', async () => {
  pending = true; open();
  await screen.findByText('Ana Prueba');
  expect(paths.filter(path => path === 'POST /jobs/job-ui/matching')).toHaveLength(1);
  expect(paths.some(path => path.endsWith('/select'))).toBe(false);
  fireEvent.click(screen.getAllByRole('button', { name: 'Ver perfil' })[0]);
  await screen.findByRole('dialog');
  expect(screen.getByText('Instalaciones y reparaciones electricas.')).toBeTruthy();
  const selectionButtons = screen.getAllByRole('button', { name: 'Seleccionar profesional' });
  failure = true;
  fireEvent.click(selectionButtons[selectionButtons.length - 1]);
  await within(screen.getByRole('dialog')).findByRole('alert');
  expect(result.selectedProfessionalId).toBeNull();
  failure = false;
  fireEvent.click(selectionButtons[selectionButtons.length - 1]);
  await screen.findByText('Profesional seleccionado');
  expect(paths.filter(path => path.endsWith('/select'))).toHaveLength(2);
  expect(screen.getByText('Seleccion guardada para la proxima etapa. Todavia no se realizo una contratacion.')).toBeTruthy();
});
it('muestra vacio sin personas inventadas y errores recuperables', async () => {
  result.matches = []; result.totalCandidates = 0; open();
  await screen.findByText('Todavia no encontramos profesionales que cumplan todos los requisitos.');
  expect(screen.queryByRole('button', { name: 'Ver perfil' })).toBeNull();
  failure = true; fireEvent.click(screen.getByRole('button', { name: 'Actualizar recomendaciones' }));
  await screen.findByRole('alert');
  failure = false; fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
});
it('no permite abrir recomendaciones con rol profesional', async () => {
  auth.role = 'profesional'; auth.user.role = 'profesional'; open();
  await waitFor(() => expect(screen.queryByText('Profesionales recomendados')).toBeNull());
  expect(paths.some(path => path.includes('/jobs/job-ui'))).toBe(false);
});
