/**
 * @archivo Router.test.tsx
 * @descripcion Flujos web contra contratos HTTP controlados, sin acceso a servicios reales.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { UserRole } from '../context/AuthContext';
import { setAuthToken } from '../lib/api/client';
import { AppRouter } from './Router';

const session = vi.hoisted(() => ({
  user: { id: 'account-1', name: 'Cuenta de prueba', email: 'cuenta@example.test', role: 'empresa' as UserRole },
  role: 'empresa' as UserRole, loading: false, isAuthenticated: true, token: 'test-token',
  demoAccessEnabled: false, logout: vi.fn(), login: vi.fn(),
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => session }));
vi.mock('../lib/firebase', () => ({ auth: null }));
vi.mock('../lib/config', () => ({ configuracion: { api: { baseUrl: 'https://api.example.test/api/v1' } } }));

type Handler = (request: RequestInit) => unknown | Promise<unknown>;
const handlers = new Map<string, Handler>();
const fetchMock = vi.fn<typeof fetch>();
const job = { id: 'job-1', titulo: 'Reparacion del tablero', descripcion: 'Reparar el tablero principal del edificio',
  empresaId: 'company-1', categoria: 'Electricidad', estado: 'publicado', ciudad: 'Rosario', moneda: 'ARS', tipoTrabajo: 'presencial' };

/** Registra una respuesta de datos con el mismo sobre usado por el backend. */
function respond(path: string, data: unknown): void {
  handlers.set(path, () => ({ exito: true, datos: data }));
}

/** Monta las rutas y layouts reales con una identidad de prueba aislada. */
function openPage(path: string, role: UserRole = 'empresa') {
  session.role = role;
  session.user.role = role;
  return render(<MemoryRouter initialEntries={[path]}><AppRouter /></MemoryRouter>);
}

/** Enumera las solicitudes emitidas por las pantallas, incluido su metodo. */
function requested(): string[] {
  return fetchMock.mock.calls.map(([input, init]) => `${init?.method} ${new URL(String(input)).pathname.replace('/api/v1', '')}${new URL(String(input)).search}`);
}

beforeEach(() => {
  handlers.clear();
  session.user.id = 'account-1';
  session.loading = false;
  session.isAuthenticated = true;
  setAuthToken('test-token');
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async (input, request = {}) => {
    const url = new URL(String(input));
    const key = `${request.method} ${url.pathname.replace('/api/v1', '')}${url.search}`;
    const handler = handlers.get(key);
    if (!handler) throw new Error(`Solicitud inesperada: ${key}`);
    const body = await handler(request);
    return body instanceof Response ? body : new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  respond('GET /subscriptions/me', null);
  respond('GET /subscriptions/billing', { pendingCheckout: null,
    entitlements: { plan: 'gratuito', paid: false, period: '2026-09',
      limits: { trabajosPublicados: 1, propuestasEnviadas: 0 }, used: {} }, payments: [] });
  respond('GET /jobs?limite=10', []);
  respond('GET /jobs?limite=100', []);
  for (const role of ['company', 'professional', 'admin']) {
    respond(`GET /dashboard/${role}`, {
      kpis: { trabajosTotales: 37 }, metricas: { tasaFinalizacion: 23 }, estadisticas: {}, resumenTrabajos: {},
      actividadReciente: [{ id: 'activity-1', titulo: 'Actividad del servidor', descripcion: 'Trabajo actualizado', fecha: '2026-09-20T12:00:00Z' }],
    });
  }
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Operaciones de agentes conectadas a API', () => {
  it('empresa no consulta endpoints administrativos al abrir Marketing por URL', async () => {
    respond('GET /support/sessions', []);
    openPage('/operations/marketing');
    expect(await screen.findByText('No hay conversaciones guardadas.')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Contactar por WhatsApp/ }).getAttribute('href'))
      .toBe('https://wa.me/5492954446198');
    expect(screen.queryByRole('link', { name: 'Marketing' })).toBeNull();
    expect(requested()).not.toContain('GET /marketing');
  });
  it('admin puede abrir Marketing sin despachar ninguna campana', async () => {
    respond('GET /marketing', []);
    openPage('/operations/marketing','admin');
    await screen.findByRole('heading', { name: 'Campanas' });
    await waitFor(() => expect(requested()).toContain('GET /marketing'));
    expect(requested().every(path => path.startsWith('GET '))).toBe(true);
  });
  it('guarda preferencias con consentimiento declarado y sin UID enviado', async () => {
    respond('GET /sales/me', null); respond('PUT /sales/me', { id: 'account-1' });
    openPage('/operations/sales');
    const save = await screen.findByRole('button', { name: 'Guardar preferencias' });
    await waitFor(() => expect(save.hasAttribute('disabled')).toBe(false));
    fireEvent.change(screen.getByLabelText('Que necesitas resolver'), { target: { value: 'Quiero reparar un tablero' } });
    fireEvent.click(save);
    await waitFor(() => expect(requested()).toContain('PUT /sales/me'));
    const call = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith('/sales/me') && init?.method === 'PUT');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ need: 'Quiero reparar un tablero', expectedMonthlyVolume: 1, consent: false });
  });
  it('no habilita guardado de memoria sin consentimiento y muestra errores de red', async () => {
    handlers.set('GET /knowledge?scope=private', () => new Response(JSON.stringify({ mensaje: 'Servicio temporalmente no disponible' }), { status: 503 }));
    openPage('/operations/knowledge');
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Guardar' }).hasAttribute('disabled')).toBe(true);
    expect(requested()).not.toContain('POST /knowledge');
  });
  it('crea y continua soporte con version y clave idempotente del mensaje', async () => {
    const record = { id: 'session-a', ownerId: 'account-1', resource: null, status: 'open', messages: [], version: 1,
      createdAt: '2026-09-27T00:00:00Z', updatedAt: '2026-09-27T00:00:00Z' };
    respond('GET /support/sessions', []); respond('POST /support/sessions', record);
    respond('GET /support/sessions/session-a', record); respond('POST /support/sessions/session-a/messages', record);
    openPage('/operations/support');
    fireEvent.click(await screen.findByRole('button', { name: 'Nueva conversacion' }));
    fireEvent.change(await screen.findByLabelText('Mensaje'), { target: { value: 'Necesito ayuda' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(requested()).toContain('POST /support/sessions/session-a/messages'));
    const request = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/messages'));
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({ message: 'Necesito ayuda', version: 1, requestId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
  });
});

describe('Pantallas conectadas a la API', () => {
  it.each([['empresa', 'company'], ['profesional', 'professional'], ['admin', 'admin']] as const)(
    'consulta el dashboard de %s', async (role, endpoint) => {
      const { container } = openPage('/dashboard', role);
      expect(await screen.findByText('37')).toBeTruthy();
      expect(container.querySelector('.ofi-workspace')?.getAttribute('data-role')).toBe(role);
      expect(container.querySelector('.ofi-workspace')?.getAttribute('data-view')).toBe('dashboard');
      expect(container.querySelectorAll('.ofi-metric')).toHaveLength(1);
      expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBe('page');
      expect(await screen.findByText('Actividad del servidor')).toBeTruthy();
      expect(requested()).toContain(`GET /dashboard/${endpoint}`);
      expect(requested().filter(path => path.startsWith('GET /dashboard/'))).toHaveLength(1);
      expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe('Bearer test-token');
    },
  );

  it('actualiza el tema al navegar sin cambiar el rol autenticado', async () => {
    const { container } = openPage('/dashboard', 'profesional');
    await screen.findByText('Actividad del servidor');
    fireEvent.click(screen.getByRole('link', { name: 'Trabajos' }));
    await screen.findByText('No hay trabajos para mostrar.');
    expect(container.querySelector('.ofi-workspace')?.getAttribute('data-view')).toBe('jobs');
    expect(container.querySelector('.ofi-workspace')?.getAttribute('data-role')).toBe('profesional');
    expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull();
  });

  it('abre y cierra la navegacion movil al elegir una pantalla', async () => {
    const { container } = openPage('/dashboard');
    await screen.findByText('Actividad del servidor');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir navegación' }));
    expect(screen.getByRole('button', { name: 'Cerrar navegación' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('link', { name: 'Trabajos' })[1]);
    await screen.findByText('No hay trabajos para mostrar.');
    expect(screen.queryByRole('button', { name: 'Cerrar navegación' })).toBeNull();
    expect(container.querySelector('.ofi-workspace')?.getAttribute('data-view')).toBe('jobs');
  });

  it('muestra vacio, error y reintento sin inventar trabajos', async () => {
    handlers.set('GET /jobs?limite=100', () => new Response(JSON.stringify({ mensaje: 'Acceso denegado' }), { status: 403 }));
    openPage('/jobs');
    expect(await screen.findByText('Acceso denegado')).toBeTruthy();
    expect(screen.queryByText('Reparacion del tablero')).toBeNull();
    respond('GET /jobs?limite=100', []);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('No hay trabajos para mostrar.')).toBeTruthy();
  });

  it('lee profesionales del servidor sin puntajes de IA ficticios', async () => {
    respond('GET /professionals?limite=100', [{ id: 'pro-1', nombre: 'Ana', apellido: 'Prueba', especialidades: ['Electricista'],
      ciudad: 'Rosario', calificacionPromedio: 0, totalResenas: 0, disponible: true, verificado: false }]);
    openPage('/professionals');
    expect(await screen.findByText('Ana Prueba')).toBeTruthy();
    expect(screen.getByText('Sin resenas')).toBeTruthy();
    expect(screen.queryByText(/% IA/)).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre, oficio o ciudad'), { target: { value: 'Plomero' } });
    expect(screen.getByText('No hay profesionales para esta busqueda.')).toBeTruthy();
  });

  it('consulta solamente la empresa propia para el rol empresa', async () => {
    respond('GET /companies/me/profile', { id: 'company-1', nombreEmpresa: 'Empresa propia', industria: 'Servicios',
      ciudad: 'Rosario', totalContrataciones: 4, planSuscripcion: 'empresa' });
    openPage('/companies');
    expect(await screen.findByText('Empresa propia')).toBeTruthy();
    expect(requested()).not.toContain('GET /companies?pagina=1&limite=20');
  });

  it('respeta la paginacion que la API devuelve fuera de datos', async () => {
    handlers.set('GET /companies?pagina=1&limite=20', () => ({ exito: true,
      datos: [{ id: 'company-1', nombreEmpresa: 'Primera empresa' }],
      paginacion: { pagina: 1, limite: 20, total: 21, totalPaginas: 2 } }));
    handlers.set('GET /companies?pagina=2&limite=20', () => ({ exito: true,
      datos: [{ id: 'company-2', nombreEmpresa: 'Ultima empresa' }],
      paginacion: { pagina: 2, limite: 20, total: 21, totalPaginas: 2 } }));
    openPage('/companies', 'admin');
    expect(await screen.findByText('Primera empresa')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText('Ultima empresa')).toBeTruthy();
    expect(screen.queryByText('Primera empresa')).toBeNull();
    expect((screen.getByRole('button', { name: 'Siguiente' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('publica y vuelve a consultar los trabajos solo tras la confirmacion HTTP', async () => {
    handlers.set('POST /jobs', request => {
      expect(JSON.parse(String(request.body))).toMatchObject({ titulo: job.titulo, descripcion: job.descripcion, ciudad: 'Rosario' });
      respond('GET /jobs?limite=100', [job]);
      return { exito: true, datos: job };
    });
    openPage('/jobs');
    await screen.findByText('No hay trabajos para mostrar.');
    fireEvent.change(screen.getByLabelText('Titulo'), { target: { value: job.titulo } });
    fireEvent.change(screen.getByLabelText('Descripcion'), { target: { value: job.descripcion } });
    fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'Rosario' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    expect(await screen.findByText(job.titulo)).toBeTruthy();
    expect(requested().filter(path => path === 'POST /jobs')).toHaveLength(1);
  });

  it('ofrece 50 categorias unicas y una opcion de escritura manual', async () => {
    openPage('/jobs');
    await screen.findByText('No hay trabajos para mostrar.');
    const select = screen.getByRole('combobox', { name: 'Categoría' }) as HTMLSelectElement;
    const options = Array.from(select.options);
    expect(select.labels?.[0]?.textContent).toBe('Categoría');
    expect(options).toHaveLength(51);
    expect(new Set(options.map(option => option.value)).size).toBe(51);
    expect(options.find(option => option.text === 'Plomería')?.value).toBe('Plomeria');
    expect(options.find(option => option.text === 'Tecnología')?.value).toBe('Tecnologia');
    expect(screen.queryByLabelText('Categoría personalizada')).toBeNull();
  });

  it.each(['Energía solar', 'Cerámica artística'])('publica un trabajo con la categoria %s', async category => {
    handlers.set('POST /jobs', request => {
      expect(JSON.parse(String(request.body)).categoria).toBe(category);
      respond('GET /jobs?limite=100', [{ ...job, categoria: category }]);
      return { exito: true, datos: { ...job, categoria: category } };
    });
    openPage('/jobs');
    await screen.findByText('No hay trabajos para mostrar.');
    fireEvent.change(screen.getByLabelText('Titulo'), { target: { value: job.titulo } });
    fireEvent.change(screen.getByLabelText('Descripcion'), { target: { value: job.descripcion } });
    fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'Rosario' } });
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: category === 'Energía solar' ? category : '__custom__' } });
    if (category !== 'Energía solar') fireEvent.change(screen.getByLabelText('Categoría personalizada'), { target: { value: `  ${category}  ` } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    expect(await screen.findByText(job.titulo)).toBeTruthy();
    expect(requested().filter(path => path === 'POST /jobs')).toHaveLength(1);
  });

  it('rechaza una categoria manual que solo contiene espacios', async () => {
    openPage('/jobs');
    await screen.findByText('No hay trabajos para mostrar.');
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: '__custom__' } });
    fireEvent.change(screen.getByLabelText('Categoría personalizada'), { target: { value: '   ' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Publicar' }).closest('form')!);
    expect(await screen.findByText('Escribí una categoría para el trabajo.')).toBeTruthy();
    expect(requested()).not.toContain('POST /jobs');
  });

  it('conserva la categoria propia al alternar opciones y si la API falla', async () => {
    handlers.set('POST /jobs', () => new Response(JSON.stringify({ mensaje: 'Error de publicacion' }), { status: 500 }));
    openPage('/jobs');
    await screen.findByText('No hay trabajos para mostrar.');
    const select = screen.getByLabelText('Categoría');
    fireEvent.change(select, { target: { value: '__custom__' } });
    fireEvent.change(screen.getByLabelText('Categoría personalizada'), { target: { value: 'Restauración de instrumentos' } });
    fireEvent.change(select, { target: { value: 'Mantenimiento' } });
    expect(screen.queryByLabelText('Categoría personalizada')).toBeNull();
    fireEvent.change(select, { target: { value: '__custom__' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Publicar' }).closest('form')!);
    await screen.findByText('Error de publicacion');
    expect((screen.getByLabelText('Categoría personalizada') as HTMLInputElement).value).toBe('Restauración de instrumentos');
  });

  it('conserva el formulario cuando el servidor rechaza la publicacion', async () => {
    handlers.set('POST /jobs', () => new Response(JSON.stringify({ mensaje: 'Limite del plan alcanzado' }), { status: 403 }));
    openPage('/jobs');
    fireEvent.change(screen.getByLabelText('Titulo'), { target: { value: job.titulo } });
    fireEvent.change(screen.getByLabelText('Descripcion'), { target: { value: job.descripcion } });
    fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'Rosario' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    expect(await screen.findByText('Limite del plan alcanzado')).toBeTruthy();
    expect((screen.getByLabelText('Titulo') as HTMLInputElement).value).toBe(job.titulo);
    expect(screen.queryByText(`Cancelar: ${job.titulo}`)).toBeNull();
  });

  it('no ofrece publicar trabajos a profesionales', async () => {
    openPage('/jobs', 'profesional');
    await screen.findByText('No hay trabajos para mostrar.');
    expect(screen.queryByRole('button', { name: 'Publicar' })).toBeNull();
  });

  it('persiste la lectura de notificaciones', async () => {
    const notification = { id: 'notification-1', titulo: 'Solicitud recibida', mensaje: 'Hay una nueva solicitud', leida: false };
    respond('GET /notifications', [notification]);
    handlers.set('POST /notifications/notification-1/read', () => {
      respond('GET /notifications', [{ ...notification, leida: true }]);
      return { exito: true, datos: { ...notification, leida: true } };
    });
    openPage('/notifications');
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar como leida' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Marcar como leida' })).toBeNull());
    expect(requested()).toContain('POST /notifications/notification-1/read');
  });

  it('no consulta analytics globales para una empresa', async () => {
    openPage('/analytics');
    expect(await screen.findByText('23')).toBeTruthy();
    expect(requested().some(path => path.startsWith('GET /analytics/'))).toBe(false);
    expect(screen.queryByRole('button', { name: 'Exportar CSV' })).toBeNull();
  });

  it('genera y descarga el reporte administrativo devuelto por la API', async () => {
    respond('GET /analytics/kpis', { usuariosTotales: 71 });
    respond('GET /analytics/usage', { eventosPorTipo: { login: 9 }, eventosPorRol: {}, trabajosPorEstado: {}, suscripcionesPorPlan: {} });
    respond('POST /analytics/reports', { id: 'report-1' });
    respond('GET /analytics/reports/report-1/export?formato=csv', { contenido: 'metrica,valor\nusuarios,71', nombreArchivo: 'reporte.csv' });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:test-report') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('reporte.csv');
    });
    openPage('/analytics', 'admin');
    expect(await screen.findByText('71')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(requested()).toContain('GET /analytics/reports/report-1/export?formato=csv');
  });

  it('protege la ruta admin y no consulta sus endpoints para empresas', async () => {
    openPage('/admin');
    await screen.findByText('Actividad del servidor');
    expect(requested().some(path => path.includes('/admin/'))).toBe(false);
  });

  it('permite suspender otra cuenta y bloquea la suspension propia en la UI', async () => {
    const users = [{ id: 'account-1', nombre: 'Mi cuenta', email: 'yo@example.test', rol: 'admin', activo: true },
      { id: 'account-2', nombre: 'Otra cuenta', email: 'otra@example.test', rol: 'empresa', activo: true }];
    respond('GET /admin/metrics', { usuarios: 2 });
    respond('GET /admin/users', users);
    handlers.set('PATCH /admin/users/account-2/status', request => {
      expect(JSON.parse(String(request.body))).toEqual({ activo: false });
      respond('GET /admin/users', [users[0], { ...users[1], activo: false }]);
      return { exito: true };
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    openPage('/admin', 'admin');
    await screen.findByText('Otra cuenta');
    const buttons = screen.getAllByRole('button', { name: 'Suspender' }) as HTMLButtonElement[];
    expect(buttons[0].disabled).toBe(true);
    fireEvent.click(buttons[1]);
    expect(await screen.findByRole('button', { name: 'Reactivar' })).toBeTruthy();
  });

  it('guarda preferencias en el servidor', async () => {
    respond('GET /auth/me', { usuario: { nombre: 'Usuario', email: 'cuenta@example.test', rol: 'empresa',
      preferenciasNotificaciones: { email: true, whatsapp: false, push: true, in_app: true } } });
    handlers.set('PUT /auth/preferences', request => {
      expect(JSON.parse(String(request.body))).toEqual({ email: false, whatsapp: false, push: true, in_app: true });
      return { exito: true };
    });
    openPage('/settings');
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Email' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Preferencias guardadas.')).toBeTruthy();
  });

  it('muestra el plan real sin deducirlo del rol ni renovar desde el navegador', async () => {
    respond('GET /subscriptions/me', { id: 'subscription-1', plan: 'profesional', estado: 'activa', renovacionAutomatica: true });
    respond('GET /subscriptions/plans?audience=profesional', []);
    respond('GET /subscriptions/history', { eventos: [] });
    openPage('/subscriptions', 'profesional');
    expect(await screen.findByText(/Renovacion automatica: si/)).toBeTruthy();
    expect(requested().every(path => path.startsWith('GET '))).toBe(true);
  });

  it('muestra precios USD y no compra antes de confirmar las condiciones', async () => {
    respond('GET /subscriptions/plans?audience=empresa', [{ id: 'empresa', audience: 'empresa', nombre: 'BUSINESS',
      priceUsd: 20, precioMensual: 20000, moneda: 'ARS', available: true,
      exchangeRate: { source: 'mercadopago', base: 'USD', quote: 'ARS', rate: 1000, asOf: '2026-10-04T00:00:00Z' },
      limitesEmpresa: { trabajosPublicados: 10 }, limitesProfesional: {} }]);
    respond('GET /subscriptions/history', { eventos: [] });
    respond('POST /subscriptions/checkout', { checkout: { estado: 'configuracion_pendiente' } });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    openPage('/subscriptions');
    expect(await screen.findByText(/US\$ 20/)).toBeTruthy();
    expect(screen.getByText(/1 USD =/).textContent).toContain('Mercado Pago');
    fireEvent.click(screen.getByRole('button', { name: 'Elegir BUSINESS' }));
    expect(requested()).not.toContain('POST /subscriptions/checkout');
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Elegir BUSINESS' }));
    await waitFor(() => expect(requested()).toContain('POST /subscriptions/checkout'));
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/subscriptions/checkout'));
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ plan: 'empresa', expectedPriceMinor: 2000000 });
    expect(JSON.parse(String(call?.[1]?.body))).not.toHaveProperty('precioMensual');
    confirm.mockRestore();
  });

  it('no permite contratar un plan sin conversion o proveedor configurado', async () => {
    respond('GET /subscriptions/plans?audience=empresa', [{ id: 'empresa', audience: 'empresa', nombre: 'BUSINESS',
      priceUsd: 20, precioMensual: null, moneda: 'ARS', available: false,
      limitesEmpresa: { trabajosPublicados: 10 }, limitesProfesional: {} }]);
    respond('GET /subscriptions/history', { eventos: [] });
    openPage('/subscriptions');
    expect(await screen.findByText('Importe local pendiente de configuracion')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Contratacion no disponible' }).hasAttribute('disabled')).toBe(true);
    expect(requested().every(path => path.startsWith('GET '))).toBe(true);
  });

  it('cancelar exige consentimiento y solo pide detener futuros debitos', async () => {
    respond('GET /subscriptions/plans?audience=empresa', []);
    respond('GET /subscriptions/history', { eventos: [] });
    respond('GET /subscriptions/me', { id: 'sub-active', plan: 'empresa', estado: 'activa', renovacionAutomatica: true });
    respond('POST /subscriptions/sub-active/cancel', {});
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    openPage('/subscriptions'); fireEvent.click(await screen.findByRole('button', { name: 'Cancelar renovacion' }));
    expect(requested()).not.toContain('POST /subscriptions/sub-active/cancel');
    confirm.mockReturnValue(true); fireEvent.click(screen.getByRole('button', { name: 'Cancelar renovacion' }));
    await screen.findByText('Renovacion cancelada; conservas el periodo pagado.');
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/subscriptions/sub-active/cancel'));
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ cancelarAlFinalDelPeriodo: true });
    confirm.mockRestore();
  });
});
