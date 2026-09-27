/** @archivo CoordinatorPage.test.tsx @descripcion Contratos web aislados: consentimiento, formularios, roles y reintentos. */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AppRouter } from './Router';
import { coordinatorActions } from './coordinatorPresentation';
import { canCommand, useCoordinator } from '../lib/api/coordinator';
import { setAuthToken } from '../lib/api/client';
import type { CoordinatorAction, CoordinatorCommand, CoordinatorList, CoordinatorRole, CoordinatorStart, CoordinatorView } from '../../../shared/coordinator';

const auth = vi.hoisted(() => ({
  user: { id: 'company-user', name: 'Empresa', email: 'test@example.test', role: 'empresa' },
  role: 'empresa', loading: false, isAuthenticated: true, logout: vi.fn(),
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../lib/firebase', () => ({ auth: null }));
vi.mock('../lib/config', () => ({ configuracion: { api: { baseUrl: 'https://api.example.test/api/v1' } } }));

let view: CoordinatorView;
let list: CoordinatorList;
let nextList: CoordinatorList;
let postFailure: number;
let getFailure: boolean;
let onPost: ((body: CoordinatorCommand | CoordinatorStart) => void) | undefined;
const posts: Array<{ path: string; body: CoordinatorCommand | CoordinatorStart; raw: string }> = [];
const paths: string[] = [];
const fetchMock = vi.fn<typeof fetch>();

/** Fecha relativa del calendario local, igual que el control date del formulario. */
function future(days = 7): string {
  const date = new Date(); date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
/** Datos sinteticos de test: nunca se escriben en Firestore. */
function fixture(role: CoordinatorRole = 'empresa'): CoordinatorView {
  return {
    role, job: { id: 'job-ui', title: 'Reparacion del tablero', description: 'Revisar el tablero del edificio.',
      category: 'Electricidad', location: { city: 'Santa Rosa', province: 'La Pampa', country: 'AR' },
      urgency: 'normal', preferredDate: null, budget: { min: null, max: null, currency: 'ARS' },
      requirements: [], estimatedScope: 'Revision del tablero', workType: 'presencial', status: 'publicado' },
    workflow: { id: 'b22cbd89-a01d-4343-9847-018d9e94a175', jobId: 'job-ui', companyId: 'company', professionalId: 'professional',
      professionalName: 'Profesional de prueba', state: 'PROFESSIONAL_SELECTED', revision: 3,
      matchingRunId: 'matching-ui', pricingEstimateId: 'pricing-ui', pricingInsufficient: true,
      offer: null, schedule: null, completionRequested: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    advice: { actions: ['contact', 'cancel'], waitingFor: 'empresa', message: 'Confirma el contacto interno.' },
    history: [{ revision: 1, action: 'started', from: 'MATCHED', to: 'PROFESSIONAL_SELECTED', actor: 'empresa', at: new Date().toISOString(), note: null }],
  };
}

/** Monta la ruta comun con StrictMode y el layout real. */
function open(path = '/dashboard/coordination/job-ui') {
  return render(<StrictMode><MemoryRouter initialEntries={[path]}><AppRouter /></MemoryRouter></StrictMode>);
}
/** Devuelve solo comandos, separados del inicio. */
function commands(): CoordinatorCommand[] { return posts.filter(row => row.path.endsWith('/commands')).map(row => row.body as CoordinatorCommand); }
/** Abre el borrador de la accion sin producir una escritura. */
async function formFor(action: CoordinatorAction) {
  fireEvent.click(await screen.findByRole('button', { name: coordinatorActions[action].label }));
  return screen.getByRole('form', { name: coordinatorActions[action].label });
}
/** Expresa consentimiento y envia exclusivamente el formulario indicado. */
function submit(form: HTMLElement) {
  const checkbox = within(form).getByRole('checkbox');
  if (!(checkbox as HTMLInputElement).checked) fireEvent.click(checkbox);
  fireEvent.submit(form);
}
/** Completa el presupuesto como importe total, no tarifa por unidad. */
function fillQuote(form: HTMLElement) {
  const ui = within(form);
  fireEvent.change(ui.getByLabelText('Referencia del presupuesto'), { target: { value: 'Presupuesto completo A' } });
  fireEvent.change(ui.getByLabelText('Importe total'), { target: { value: '24000' } });
  fireEvent.change(ui.getByLabelText('Valido hasta'), { target: { value: future() } });
  fireEvent.change(ui.getByLabelText('Cantidad'), { target: { value: '4' } });
  fireEvent.change(ui.getByLabelText('Materiales'), { target: { value: 'included' } });
  fireEvent.change(ui.getByLabelText('Impuestos'), { target: { value: 'excluded' } });
}

beforeEach(() => {
  auth.role = 'empresa'; auth.user.role = 'empresa'; auth.user.id = 'company-user'; auth.isAuthenticated = true;
  view = fixture(); list = { items: [], nextCursor: null }; nextList = { items: [], nextCursor: null };
  postFailure = 0; getFailure = false; onPost = undefined; posts.length = 0; paths.length = 0;
  setAuthToken('test-token'); vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset().mockImplementation(async (input, init = {}) => {
    const url = new URL(String(input)); const path = url.pathname.replace('/api/v1', '');
    paths.push((init.method ?? 'GET') + ' ' + path + url.search);
    if (init.method === 'POST') {
      const body = JSON.parse(String(init.body)) as CoordinatorCommand | CoordinatorStart;
      posts.push({ path, body, raw: String(init.body) });
      if (postFailure) return new Response(JSON.stringify({ mensaje: postFailure === 409 ? 'La coordinacion cambio.' : 'Respuesta no disponible.' }), { status: postFailure });
      onPost?.(body);
      if ('action' in body && view.workflow) view = { ...view, workflow: { ...view.workflow, revision: view.workflow.revision + 1 } };
      else if (!('action' in body)) view = { ...fixture(), workflow: { ...fixture().workflow!, revision: 1 } };
    }
    if (getFailure && init.method !== 'POST' && path.includes('coordinator')) return new Response(JSON.stringify({ mensaje: 'Sin acceso a la coordinacion.' }), { status: 403 });
    const datos = path === '/coordinator' ? (url.search ? nextList : list)
      : path.includes('/coordinator') ? view
        : path.startsWith('/dashboard/') ? { kpis: {}, actividadReciente: [], metricas: {}, resumenTrabajos: {}, estadisticas: {} }
          : path === '/subscriptions/me' ? null : [];
    return new Response(JSON.stringify({ exito: true, datos }));
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('solo lee al montar; muestra insuficiencia e historial sin inventar lectura del contacto', async () => {
  view.workflow!.state = 'CONTACTED'; view.advice = { actions: ['cancel'], waitingFor: 'profesional', message: 'Falta la respuesta del profesional.' };
  view.history.push({ revision: 2, action: 'invitation_delivered', from: 'CONTACT_PENDING', to: 'CONTACTED', actor: 'system', at: new Date().toISOString(), note: null });
  open(); await screen.findByText('Falta la respuesta del profesional.');
  expect(posts).toHaveLength(0);
  expect(screen.getByText('Coordinacion iniciada')).toBeTruthy();
  expect(screen.getByText('Invitacion interna entregada')).toBeTruthy();
  expect(screen.getByText(/La estimacion tiene informacion insuficiente/)).toBeTruthy();
  expect(screen.queryByText('invitation_delivered')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Responder a la empresa' })).toBeNull();
});

it('exige consentimiento para iniciar, admite insuficiencia y conserva UUID tras fallo', async () => {
  view.workflow = null; view.advice.actions = []; postFailure = 503;
  open();
  const start = await screen.findByRole('button', { name: 'Iniciar coordinacion' });
  expect((start as HTMLButtonElement).disabled).toBe(true); expect(posts).toHaveLength(0);
  fireEvent.click(screen.getByRole('checkbox', { name: /Reconozco/ }));
  fireEvent.click(start); await screen.findByText('Operacion sin confirmar');
  expect(posts[0].body).toEqual({ acknowledgeEstimate: true, idempotencyKey: expect.stringMatching(/^[\da-f-]{36}$/i) });
  postFailure = 0; fireEvent.click(screen.getByRole('button', { name: 'Reintentar operacion' }));
  await screen.findByText('Operacion confirmada por el servidor.');
  expect(posts).toHaveLength(2); expect(posts[1].raw).toBe(posts[0].raw);
});

it('profesional no puede iniciar una coordinacion inexistente', async () => {
  auth.role = auth.user.role = 'profesional'; view = fixture('profesional'); view.workflow = null;
  open(); await screen.findByText('La empresa debe iniciar la coordinacion.');
  expect(screen.queryByRole('button', { name: 'Iniciar coordinacion' })).toBeNull();
  expect(posts).toHaveLength(0);
});

it.each(['publicado', 'cancelado'])('reinicio de CANCELLED depende del estado %s del trabajo', async status => {
  view.workflow!.state = 'CANCELLED'; view.advice.actions = []; view.job.status = status;
  open(); await screen.findByText('Coordinacion cancelada');
  const button = screen.queryByRole('button', { name: 'Reiniciar coordinacion' });
  if (status === 'cancelado') expect(button).toBeNull();
  else {
    expect(button).toBeTruthy(); fireEvent.click(screen.getByRole('checkbox', { name: /Reconozco/ })); fireEvent.click(button!);
    await screen.findByText('Coordinacion iniciada.');
    expect(posts[0].body).toHaveProperty('acknowledgeEstimate', true);
  }
});

it('contacto requiere confirmacion y usa solo el comando interno con revision', async () => {
  open(); const form = await formFor('contact');
  expect(posts).toHaveLength(0);
  expect(within(form).getByText(/solo una notificacion interna/)).toBeTruthy();
  submit(form); await screen.findByText('Operacion confirmada por el servidor.');
  expect(commands()).toEqual([{ action: 'contact', workflowId: view.workflow!.id, revision: 3, idempotencyKey: expect.any(String) }]);
  expect(paths.filter(path => path.startsWith('POST'))).toEqual(['POST /jobs/job-ui/coordinator/commands']);
});

it.each([503, 409])('preserva cuerpo y revision en reintentos HTTP %s incluso tras GET', async status => {
  postFailure = status; open(); const form = await formFor('contact'); submit(form);
  await screen.findByText('Operacion sin confirmar');
  expect((screen.getAllByRole('button', { name: 'Notificar al profesional' })[0] as HTMLButtonElement).disabled).toBe(true);
  view = { ...view, workflow: { ...view.workflow!, revision: 9 } };
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar coordinacion' }));
  await screen.findByText(/Revision 9/);
  postFailure = 0; fireEvent.click(screen.getByRole('button', { name: 'Reintentar operacion' }));
  await screen.findByText('Operacion confirmada por el servidor.');
  expect(posts).toHaveLength(2); expect(posts[1].raw).toBe(posts[0].raw); expect(commands()[1].revision).toBe(3);
});

it('recupera conflictos con GET antes de emitir un nuevo UUID y revision', async () => {
  postFailure = 409; open(); submit(await formFor('contact')); await screen.findByText('Operacion sin confirmar');
  view = { ...view, workflow: { ...view.workflow!, revision: 11 } };
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar y descartar reintento' }));
  await waitFor(() => expect(screen.queryByText('Operacion sin confirmar')).toBeNull());
  postFailure = 0; submit(await formFor('contact')); await screen.findByText('Operacion confirmada por el servidor.');
  expect(commands()[1].revision).toBe(11); expect(commands()[1].idempotencyKey).not.toBe(commands()[0].idempotencyKey);
});

it.each(['submit_quote', 'counter_offer'] as const)('%s envia PricingQuote completo y total sin multiplicar por cantidad', async action => {
  view = fixture(action === 'submit_quote' ? 'profesional' : 'empresa'); auth.role = auth.user.role = view.role;
  view.advice.actions = [action]; open(); const form = await formFor(action);
  submit(form); expect(commands()).toHaveLength(0);
  fillQuote(form); expect(commands()).toHaveLength(0); submit(form);
  await screen.findByText('Operacion confirmada por el servidor.');
  expect(commands()[0].quote).toEqual({ id: expect.any(String), label: 'Presupuesto completo A', amount: 24000, validUntil: future(),
    currency: 'ARS', scope: 'Revision del tablero', unit: 'hour', quantity: 4, materials: 'included', taxes: 'excluded' });
});

it('bloquea coberturas desconocidas y vigencia fuera de hoy a un ano sin POST', async () => {
  view.advice.actions = ['submit_quote']; open(); const form = await formFor('submit_quote'); fillQuote(form);
  fireEvent.change(within(form).getByLabelText('Materiales'), { target: { value: 'unknown' } }); submit(form);
  expect(await screen.findByText('Confirma si materiales e impuestos estan incluidos o excluidos.')).toBeTruthy();
  expect(posts).toHaveLength(0);
  fireEvent.change(within(form).getByLabelText('Materiales'), { target: { value: 'included' } });
  const expiry = within(form).getByLabelText('Valido hasta') as HTMLInputElement;
  for (const days of [-1, 400]) {
    fireEvent.change(expiry, { target: { value: future(days) } }); submit(form);
    expect(expiry.checkValidity()).toBe(false);
  }
  expect(posts).toHaveLength(0);
});

it.each(['empresa', 'profesional'] as const)('SCHEDULE_PENDING habilita propuesta de %s sin espera ficticia', async role => {
  auth.role = auth.user.role = role; view = fixture(role); view.workflow!.state = 'SCHEDULE_PENDING';
  view.advice = { actions: ['propose_schedule', 'cancel'], waitingFor: null, message: 'Propongan fecha y horario.' };
  open(); const form = await formFor('propose_schedule');
  expect(screen.queryByText(/Esperando a:/)).toBeNull();
  const start = future(2) + 'T10:00'; const end = future(2) + 'T12:00';
  fireEvent.change(within(form).getByLabelText('Inicio'), { target: { value: start } });
  fireEvent.change(within(form).getByLabelText('Fin'), { target: { value: future(2) + 'T09:00' } }); submit(form);
  expect(await screen.findByText(/Indica un inicio futuro dentro de un ano/)).toBeTruthy(); expect(posts).toHaveLength(0);
  fireEvent.change(within(form).getByLabelText('Fin'), { target: { value: end } }); submit(form);
  await screen.findByText('Operacion confirmada por el servidor.');
  expect(commands()[0].schedule).toEqual({ startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() });
});

it('muestra terminos, fecha y consentimiento bilateral antes de asignar', async () => {
  view.workflow!.state = 'SCHEDULED'; view.advice.actions = ['confirm_schedule'];
  view.workflow!.offer = { accepted: true, proposedBy: 'profesional', quote: { id: 'quote-id-123456789', label: 'Oferta vigente', amount: 50000,
    currency: 'ARS', scope: 'Revision completa del tablero', quantity: 4, unit: 'hour', materials: 'included', taxes: 'excluded', validUntil: future() } };
  view.workflow!.schedule = { startsAt: future(2) + 'T10:00:00Z', endsAt: future(2) + 'T12:00:00Z', proposedBy: 'profesional', confirmed: false };
  open(); const form = await formFor('confirm_schedule');
  expect(screen.getByText('Oferta aceptada')).toBeTruthy(); expect(screen.getByText('50.000 ARS')).toBeTruthy();
  expect(screen.getByText('Horas de trabajo: 4')).toBeTruthy(); expect(screen.getByText('Fecha propuesta, sin confirmar')).toBeTruthy();
  expect(within(form).getByText(/este acuerdo bilateral asigna el trabajo/)).toBeTruthy(); expect(posts).toHaveLength(0);
  submit(form); await screen.findByText('Operacion confirmada por el servidor.');
  expect(commands()[0].action).toBe('confirm_schedule');
});

it.each(['empresa', 'profesional'] as const)('cancel exige motivo 3..500 y explica efecto para %s', async role => {
  auth.role = auth.user.role = role; view = fixture(role);
  open(); const form = await formFor('cancel'); const note = within(form).getByLabelText('Motivo de cancelacion (obligatorio)') as HTMLTextAreaElement;
  expect(note.required).toBe(true); expect(note.minLength).toBe(3); expect(note.maxLength).toBe(500);
  fireEvent.change(note, { target: { value: 'ab' } }); submit(form);
  expect(posts).toHaveLength(0);
  expect(within(form).getByText(role === 'empresa' ? /tambien se cancela el trabajo/ : /se libera tu seleccion/)).toBeTruthy();
  fireEvent.change(note, { target: { value: 'No puedo continuar' } }); submit(form);
  await screen.findByText('Operacion confirmada por el servidor.'); expect(commands()[0].note).toBe('No puedo continuar');
});

it('start_work solo profesional desde fecha; complete solo empresa tras solicitud', () => {
  view.advice.actions = ['start_work', 'complete', 'cancel']; view.workflow!.state = 'CONFIRMED';
  view.workflow!.schedule = { startsAt: new Date(Date.now() - 1000).toISOString(), endsAt: future(1) + 'T12:00:00Z', proposedBy: 'empresa', confirmed: true };
  expect(canCommand(view, 'start_work')).toBe(false);
  view.role = 'profesional'; expect(canCommand(view, 'start_work')).toBe(true);
  expect(canCommand(view, 'start_work', Date.now() - 2000)).toBe(false);
  view.workflow!.state = 'IN_PROGRESS'; expect(canCommand(view, 'cancel')).toBe(false);
  expect(canCommand(view, 'complete')).toBe(false); view.role = 'empresa';
  expect(canCommand(view, 'complete')).toBe(false); view.workflow!.completionRequested = true;
  expect(canCommand(view, 'complete')).toBe(true);
  view.advice.actions = []; expect(canCommand(view, 'complete')).toBe(false);
});

it('renderiza complete solo despues de la solicitud del profesional', async () => {
  view.workflow!.state = 'IN_PROGRESS'; view.advice.actions = ['complete'];
  open(); await screen.findByText('Trabajo en curso');
  expect(screen.queryByRole('button', { name: 'Confirmar trabajo completado' })).toBeNull();
  view = { ...view, workflow: { ...view.workflow!, completionRequested: true } };
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar coordinacion' }));
  submit(await formFor('complete')); await screen.findByText('Operacion confirmada por el servidor.');
  expect(commands()[0].action).toBe('complete');
});

it.each(['empresa', 'profesional'] as const)('bandeja de %s pagina por cursor y navega al detalle comun', async role => {
  auth.role = auth.user.role = role; view = fixture(role);
  list = { items: [{ jobId: 'job-ui', title: 'Primera coordinacion', state: 'CONTACTED', updatedAt: new Date().toISOString() }], nextCursor: 'cursor_2' };
  nextList = { items: [{ jobId: 'job-other', title: 'Segunda coordinacion', state: 'CONFIRMED', updatedAt: new Date().toISOString() }], nextCursor: null };
  open('/dashboard/coordination');
  await screen.findByText('Primera coordinacion');
  expect(screen.getByRole('link', { name: 'Coordinacion' }).getAttribute('href')).toBe('/dashboard/coordination');
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' })); await screen.findByText('Segunda coordinacion');
  expect(paths).toContain('GET /coordinator?cursor=cursor_2');
  fireEvent.click(screen.getByRole('button', { name: 'Anterior' })); await screen.findByText('Primera coordinacion');
  fireEvent.click(screen.getByRole('link', { name: /Primera coordinacion/ })); await screen.findByText('Reparacion del tablero');
  expect(paths).toContain('GET /jobs/job-ui/coordinator');
});

it('bandeja vacia y errores tienen estados reales recuperables', async () => {
  getFailure = true; open('/dashboard/coordination'); await screen.findByRole('alert');
  expect(screen.queryByText('No hay coordinaciones en esta pagina.')).toBeNull();
  getFailure = false; fireEvent.click(screen.getByRole('button', { name: 'Reintentar consulta' }));
  await screen.findByText('No hay coordinaciones en esta pagina.');
  expect((screen.getByRole('button', { name: 'Siguiente' }) as HTMLButtonElement).disabled).toBe(true);
});

it('prohibe ruta y bandeja al administrador sin consultar Coordinator', async () => {
  auth.role = auth.user.role = 'admin'; open();
  await screen.findByText('Administrador');
  expect(paths.some(path => path.includes('coordinator'))).toBe(false);
  expect(screen.queryByRole('link', { name: 'Coordinacion' })).toBeNull();
});

it('doble envio se serializa sin duplicar comandos', async () => {
  const hook = renderHook(() => useCoordinator('job-ui')); await waitFor(() => expect(hook.result.current.busy).toBe(false));
  await act(async () => {
    const first = hook.result.current.command({ action: 'contact' });
    const second = hook.result.current.command({ action: 'contact' });
    expect(await second).toBe(false); expect(await first).toBe(true);
  });
  expect(commands()).toHaveLength(1);
});

it.each(['cuenta', 'trabajo'])('el hook limpia acuerdo e intento fallido al cambiar %s sin remount', async change => {
  const hook = renderHook(({ id }) => useCoordinator(id), { initialProps: { id: 'job-ui' } });
  await waitFor(() => expect(hook.result.current.view?.workflow?.revision).toBe(3));
  postFailure = 503; await act(async () => { await hook.result.current.command({ action: 'contact' }); });
  expect(hook.result.current.failedAttempt).toBeTruthy();
  const id = change === 'trabajo' ? 'job-other' : 'job-ui';
  if (change === 'cuenta') auth.user.id = 'another-user';
  view = { ...fixture(), job: { ...fixture().job, id, title: 'Otro trabajo' } };
  let resolve!: (response: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }));
  hook.rerender({ id });
  expect(hook.result.current.view).toBeNull(); expect(hook.result.current.failedAttempt).toBeNull();
  expect(hook.result.current.error).toBe(''); expect(hook.result.current.busy).toBe(true);
  await waitFor(() => expect(resolve).toBeTypeOf('function'));
  await act(async () => { resolve(new Response(JSON.stringify({ exito: true, datos: view }))); });
  expect(hook.result.current.view?.job.id).toBe(id);
});

it('reintento conserva workflowId antiguo aunque el nuevo acuerdo repita revision', async () => {
  postFailure = 409; open(); submit(await formFor('contact')); await screen.findByText('Operacion sin confirmar');
  const original = commands()[0];
  view = { ...view, workflow: { ...view.workflow!, id: '4a4d2314-ce9b-48b3-9cc4-22c295eecf8b', revision: original.revision } };
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar coordinacion' }));
  await waitFor(() => expect((screen.getByRole('button', { name: 'Actualizar coordinacion' }) as HTMLButtonElement).disabled).toBe(false));
  postFailure = 0; fireEvent.click(screen.getByRole('button', { name: 'Reintentar operacion' }));
  await screen.findByText('Operacion confirmada por el servidor.');
  expect(commands()[1]).toEqual(original); expect(commands()[1].workflowId).not.toBe(view.workflow!.id);
});

it('ignora una respuesta tardia de la identidad anterior', async () => {
  let resolve!: (response: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; }));
  const hook = renderHook(({ id }) => useCoordinator(id), { initialProps: { id: 'job-ui' } });
  const old = fixture(); auth.user.id = 'new-account';
  view = { ...fixture(), job: { ...fixture().job, id: 'new-job', title: 'Nuevo acuerdo' } };
  hook.rerender({ id: 'new-job' }); await waitFor(() => expect(hook.result.current.view?.job.id).toBe('new-job'));
  await act(async () => { resolve(new Response(JSON.stringify({ exito: true, datos: old }))); });
  expect(hook.result.current.view?.job.id).toBe('new-job');
});

it('consulta GET una vez al llegar la fecha para obtener start_work, sin POST automatico', async () => {
  vi.useFakeTimers(); auth.role = auth.user.role = 'profesional'; view = fixture('profesional');
  view.workflow!.state = 'CONFIRMED'; view.advice.actions = [];
  view.workflow!.schedule = { startsAt: new Date(Date.now() + 10000).toISOString(), endsAt: new Date(Date.now() + 20000).toISOString(), proposedBy: 'empresa', confirmed: true };
  const hook = renderHook(() => useCoordinator('job-ui'));
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(hook.result.current.view?.advice.actions).toEqual([]);
  view = { ...view, advice: { ...view.advice, actions: ['start_work'] } };
  await act(async () => { await vi.advanceTimersByTimeAsync(10100); });
  expect(hook.result.current.view?.advice.actions).toEqual(['start_work']);
  await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
  expect(paths.filter(path => path === 'GET /jobs/job-ui/coordinator')).toHaveLength(2);
  expect(posts).toHaveLength(0);
});
