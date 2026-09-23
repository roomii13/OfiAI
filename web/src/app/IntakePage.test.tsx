/**
 * @archivo IntakePage.test.tsx
 * @descripcion Flujos HTTP controlados de Intake con router, resumen y confirmacion reales.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRouter } from './Router';
import { setAuthToken } from '../lib/api/client';
import type { IntakeSession } from '../../../shared/intake';

const auth = vi.hoisted(() => ({
  user: { id: 'company-user', name: 'Empresa', email: 'test@example.test', role: 'empresa' },
  role: 'empresa', loading: false, isAuthenticated: true, token: 'test-token', logout: vi.fn(),
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../lib/firebase', () => ({ auth: null }));
vi.mock('../lib/config', () => ({ configuracion: { api: { baseUrl: 'https://api.example.test/api/v1' } } }));
const fetchMock = vi.fn<typeof fetch>();
let session: IntakeSession;
let fails = false;
const commands: Array<{ path: string; body: Record<string, unknown> }> = [];

/** Produce una sesion sintetica de UI, nunca una respuesta real de Gemini. */
function fixture(): IntakeSession {
  return {
    id: 'intake-test-session-1234', companyId: 'company-1', userId: 'company-user', schemaVersion: 1,
    version: 0, status: 'active', jobId: null, createdAt: '2026-09-23T00:00:00Z', updatedAt: '2026-09-23T00:00:00Z',
    message: 'Contame que necesitas.', messages: [{ id: 'welcome', role: 'assistant', content: 'Contame que necesitas.', createdAt: '2026-09-23T00:00:00Z' }],
    extractedData: {
      category: null, title: null, description: null, location: { country: null, city: null, region: null },
      urgency: null, preferredDate: null, budget: { min: null, max: null, currency: null }, budgetStatus: 'unknown',
      estimatedScope: null, requirements: [], attachmentsRequired: null, attachmentReason: null,
      multipleProfessionals: null, professionalTypes: [], workType: null,
    }, missingInformation: ['location'], completionPercentage: 0, readyToCreateJob: false,
  };
}

/** Monta las rutas de produccion con identidad y HTTP aislados. */
function open(path = '/dashboard/company/ai-request') {
  return render(<MemoryRouter initialEntries={[path]}><AppRouter /></MemoryRouter>);
}

/** Escribe y envia un mensaje como lo haria una empresa. */
async function send(message: string): Promise<void> {
  fireEvent.change(screen.getByLabelText('Tu mensaje'), { target: { value: message } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
  await waitFor(() => expect(screen.queryByText('La IA esta analizando...')).toBeNull());
}

beforeEach(() => {
  session = fixture(); commands.length = 0; fails = false;
  auth.user.id = 'company-user'; auth.role = 'empresa'; auth.user.role = 'empresa';
  setAuthToken('test-token');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset().mockImplementation(async (input, init = {}) => {
    const url = new URL(String(input));
    const path = url.pathname.replace('/api/v1', '');
    let data: unknown = null;
    if (init.method === 'POST') {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      commands.push({ path, body });
      if (path.endsWith('/messages')) {
        if (fails) return new Response(JSON.stringify({ mensaje: 'La IA no esta disponible ahora.' }), { status: 503 });
        session = { ...session, version: session.version + 1, status: 'ready', readyToCreateJob: true, completionPercentage: 100, missingInformation: [],
          extractedData: { ...session.extractedData, category: 'Impermeabilizacion', title: 'Reparar la fachada',
            description: 'Reparacion de humedad en edificio de cinco pisos.', location: { country: 'Argentina', city: 'Santa Rosa', region: 'La Pampa' },
            urgency: 'high', preferredDate: 'Proxima semana', estimatedScope: '5 pisos, 18 departamentos', budgetStatus: 'to_quote', workType: 'presencial' },
          messages: [...session.messages, { id: 'user-' + session.version, role: 'user', content: String(body.message), createdAt: session.updatedAt },
            { id: 'assistant-' + session.version, role: 'assistant', content: 'Revisa el resumen antes de publicar.', createdAt: session.updatedAt }] };
        if (String(body.message).includes('corregir')) session = { ...session, status: 'active', readyToCreateJob: false, missingInformation: ['location'], completionPercentage: 80 };
      } else if (path.endsWith('/confirm')) {
        expect(body).toEqual({ confirmed: true, expectedVersion: session.version });
        session = { ...session, version: session.version + 1, status: 'published', jobId: 'ai_' + session.id };
      }
      data = session;
    } else if (path === '/ai/intake/sessions') data = [{ id: session.id, title: 'Conversacion guardada', status: session.status, updatedAt: session.updatedAt }];
    else if (path === '/ai/intake/sessions/' + session.id) data = session;
    else if (path === '/subscriptions/me') data = null;
    else throw new Error('Endpoint inesperado: ' + path);
    return new Response(JSON.stringify({ exito: true, datos: data }), { status: 200 });
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('inicia, conversa y publica solo despues de revisar y confirmar', async () => {
  open();
  fireEvent.click(screen.getByRole('button', { name: 'Nueva conversacion' }));
  await screen.findByText('Contame que necesitas.');
  expect(commands).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Publicar solicitud' })).toBeNull();
  await send('Necesito reparar humedad en un edificio.');
  const publish = await screen.findByRole('button', { name: 'Publicar solicitud' });
  expect(screen.getByText('Santa Rosa, La Pampa, Argentina')).toBeTruthy();
  expect(screen.getByText('A cotizar')).toBeTruthy();
  expect(commands.some(command => command.path.endsWith('/confirm'))).toBe(false);
  fireEvent.click(publish); fireEvent.click(publish);
  await screen.findByText('Solicitud publicada');
  expect(commands.filter(command => command.path.endsWith('/confirm'))).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Ver mis trabajos' }).getAttribute('href')).toBe('/jobs');
  expect((screen.getByLabelText('Tu mensaje') as HTMLTextAreaElement).disabled).toBe(true);
  expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer test-token');
});

it('preserva el borrador y el requestId al fallar Gemini y reintentar', async () => {
  open('/dashboard/company/ai-request?session=' + session.id);
  await screen.findByText('Contame que necesitas.');
  fails = true; await send('Necesito un plomero.');
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect((screen.getByLabelText('Tu mensaje') as HTMLTextAreaElement).value).toBe('Necesito un plomero.');
  fails = false; await send('Necesito un plomero.');
  await screen.findByRole('button', { name: 'Publicar solicitud' });
  expect(commands[0].body.requestId).toBe(commands[1].body.requestId);
  expect((screen.getByLabelText('Tu mensaje') as HTMLTextAreaElement).value).toBe('');
});

it('recupera contexto y exige volver a completar datos despues de una correccion', async () => {
  open('/dashboard/company/ai-request?session=' + session.id);
  await screen.findByText('Contame que necesitas.');
  await send('Detalle completo del edificio.');
  fireEvent.click(await screen.findByRole('button', { name: 'Editar informacion' }));
  expect((screen.getByRole('button', { name: 'Publicar solicitud' }) as HTMLButtonElement).disabled).toBe(true);
  await send('Quiero corregir la ciudad.');
  expect(screen.queryByRole('button', { name: 'Publicar solicitud' })).toBeNull();
  expect(screen.getByText('Falta completar')).toBeTruthy();
  expect(commands.some(command => command.path.endsWith('/confirm'))).toBe(false);
});

it('no muestra el agente a un profesional', async () => {
  auth.role = 'profesional'; auth.user.role = 'profesional';
  open();
  await waitFor(() => expect(screen.queryByText('Asistente de solicitudes')).toBeNull());
  expect(commands).toHaveLength(0);
});

