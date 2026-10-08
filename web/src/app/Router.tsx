/**
 * @archivo Router.tsx
 * @descripcion Sistema principal de rutas y pantallas web de OfiAI.
 * Implementa rutas públicas, rutas autenticadas y vistas por rol sin modificar
 * la estructura de carpetas existente.
 * @modulo Routing
 */
import { Fragment, type FormEvent, type ReactNode, useState } from 'react';
import { SubscriptionBillingPanel } from './SubscriptionBillingPanel';
import { CitizenRegisterPage } from './CitizenRegisterPage';
import { AgentWorkspace } from './AgentWorkspace';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Building2,
  Clock3,
  Download,
  MapPin,
  MessageSquare,
  Plus,
  Search,
  Send,
  Sparkles,
  Star,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import { AuthLayout } from '../layouts/AuthLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { IntakePage } from './IntakePage';
import { JobMatchesPage } from './JobMatchesPage';
import { JobPricingPage } from './JobPricingPage';
import { CoordinatorPage, CoordinationInboxPage } from './CoordinatorPage';
import { SettlementsPage, SettlementAccountForm } from './SettlementsPage';
import {
  useAuth,
  type RegisterCompanyInput,
  type RegisterProfessionalInput,
  type UserRole,
} from '../context/AuthContext';
import { api } from '../lib/api/client';
import { JOB_CATEGORY_GROUPS } from '../lib/jobCategories';
import { dashboardEndpoint, getData, metricLabel, toJobSummary, toMetrics, useApiResource } from '../lib/api/resources';
import type { AdminUserData, CompanyData, DashboardData, JobData, NotificationData, NotificationPreferences, AccountData, PlanData, SubscriptionData, ProfessionalData, UsageData } from '../../../shared/contracts';
import { enviarMensajeIa } from '../lib/gemini';
import type {
  ActividadReciente,
  KpiDashboard,
  PlanSuscripcion,
  TrabajoResumen,
} from '../shared/types';

interface ApiEnvelope<T> {
  exito: boolean;
  mensaje?: string;
  datos?: T;
}

interface ChatMessage {
  id: string;
  author: 'usuario' | 'ia';
  text: string;
}

/**
 * Renderiza el árbol de rutas principal de OfiAI Web.
 */
export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><RegisterChoicePage /></GuestRoute>} />
      <Route path="/register/company" element={<GuestRoute><CompanyRegisterPage /></GuestRoute>} />
      <Route path="/register/citizen" element={<GuestRoute><CitizenRegisterPage /></GuestRoute>} />
      <Route path="/register/professional" element={<GuestRoute><ProfessionalRegisterPage /></GuestRoute>} />
      <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />

      <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      <Route path="/operations/:section" element={<RequireAuth><AgentWorkspace /></RequireAuth>} />
      <Route path="/dashboard/company/ai-request" element={<RequireAuth roles={['empresa']}><IntakePage /></RequireAuth>} />
      <Route path="/dashboard/company/jobs/:jobId/matches" element={<RequireAuth roles={['empresa']}><JobMatchesPage /></RequireAuth>} />
      <Route path="/dashboard/company/jobs/:jobId/pricing" element={<RequireAuth roles={['empresa']}><JobPricingPage /></RequireAuth>} />
      <Route path="/dashboard/coordination" element={<RequireAuth roles={['empresa', 'profesional']}><CoordinationInboxPage /></RequireAuth>} />
      <Route path="/dashboard/coordination/:jobId" element={<RequireAuth roles={['empresa', 'profesional']}><CoordinatorPage /></RequireAuth>} />
      <Route path="/companies" element={<RequireAuth roles={['empresa', 'admin']}><CompaniesPage /></RequireAuth>} />
      <Route path="/professionals" element={<RequireAuth><ProfessionalsPage /></RequireAuth>} />
      <Route path="/jobs" element={<RequireAuth><JobsPage /></RequireAuth>} />
      <Route path="/ai" element={<RequireAuth><AiPage /></RequireAuth>} />
      <Route path="/subscriptions" element={<RequireAuth><SubscriptionsPage /></RequireAuth>} />
      <Route path="/subscriptions/success" element={<RequireAuth><SubscriptionSuccessPage /></RequireAuth>} />
      <Route path="/analytics" element={<RequireAuth><AnalyticsPage /></RequireAuth>} />
      <Route path="/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth roles={['admin']}><AdminPage /></RequireAuth>} />
      <Route path="/admin/settlements" element={<RequireAuth roles={['admin']}><SettlementsPage /></RequireAuth>} />
      <Route path="/company/*" element={<Navigate to="/companies" replace />} />
      <Route path="/professional/*" element={<Navigate to="/professionals" replace />} />
      <Route path="/admin/*" element={<Navigate to="/admin" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

/**
 * Protege rutas internas y valida roles cuando corresponde.
 */
function RequireAuth({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: UserRole[];
}) {
  const { isAuthenticated, role, loading, user } = useAuth();
  if (loading) return <p role="status">Cargando sesion...</p>;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && (!role || !roles.includes(role))) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Fragment key={user?.id}>{children}</Fragment>;
}

/**
 * Evita mostrar login o registro cuando ya existe sesión activa.
 */
function GuestRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, initializing } = useAuth();
  if (initializing) return <p role="status">Cargando sesion...</p>;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

/**
 * Pantalla de inicio de sesión con acceso real y perfiles demo de desarrollo.
 */
function LoginPage() {
  const navigate = useNavigate();
  const { login, loginAsDemo, loading, demoAccessEnabled } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  /**
   * Intenta iniciar sesión contra el backend configurado.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');

    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible iniciar sesión.');
    }
  }

  /**
   * Activa una sesión local para recorrer el producto en entornos no productivos.
   */
  function handleDemo(role: UserRole): void {
    try {
      loginAsDemo(role);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'El acceso demo no está disponible.');
    }
  }

  return (
    <AuthLayout withBackground>
      <div className="mb-8">
        <p className="text-3xl font-bold text-brand-700">OfiAI</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-950">Ingresar a la operación</h1>
        <p className="mt-2 text-sm text-gray-600">Gestioná trabajos, profesionales, IA, pagos y métricas desde un solo lugar.</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Email</span>
          <input
            className="ofi-input mt-1"
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Contraseña</span>
          <input
            className="ofi-input mt-1"
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            required
          />
        </label>

        {error && (
          <div role="alert" className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <button className="ofi-btn-primary w-full justify-center" type="submit" disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>

      {demoAccessEnabled && <p className="mt-5 text-sm text-gray-600">Demo del hackatón: ingresá con las credenciales de referencia o elegí un rol. Datos ficticios, solo lectura.</p>}
      {demoAccessEnabled && (
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <button className="ofi-btn-secondary justify-center" type="button" onClick={() => handleDemo('empresa')}>
            Empresa
          </button>
          <button className="ofi-btn-secondary justify-center" type="button" onClick={() => handleDemo('profesional')}>
            Profesional
          </button>
          <button className="ofi-btn-secondary justify-center" type="button" onClick={() => handleDemo('admin')}>
            Admin
          </button>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between text-sm">
        <Link className="font-medium text-brand-700 hover:text-brand-800" to="/forgot-password">
          Recuperar contraseña
        </Link>
        <Link className="font-medium text-gray-700 hover:text-gray-950" to="/register">
          Crear cuenta
        </Link>
      </div>
    </AuthLayout>
  );
}

/**
 * Pantalla para elegir el tipo de registro.
 */
function RegisterChoicePage() {
  return (
    <AuthLayout>
      <div className="mb-8">
        <p className="text-sm font-semibold text-brand-700">Registro</p>
        <h1 className="mt-2 text-3xl font-bold text-gray-950">Elegí cómo querés operar</h1>
        <p className="mt-2 text-sm text-gray-600">OfiAI adapta dashboards, IA y suscripciones según el rol de la cuenta.</p>
      </div>

      <div className="grid gap-4">
        <Link className="rounded-lg border border-border bg-sky-50 p-5 transition hover:border-sky-400" to="/register/citizen">
          <UserPlus className="h-6 w-6 text-sky-700" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold">Soy particular</h2>
          <p className="mt-1 text-sm text-gray-600">Profesionales para tu hogar y proyectos personales. Cuenta gratis para siempre.</p>
        </Link>
        <Link className="rounded-lg border border-border bg-white p-5 transition hover:border-brand-300 hover:bg-brand-50" to="/register/company">
          <Building2 className="h-6 w-6 text-brand-700" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold">Registrar empresa</h2>
          <p className="mt-1 text-sm text-gray-600">Publicá trabajos, encontrá profesionales y gestioná pagos con Mercado Pago.</p>
        </Link>
        <Link className="rounded-lg border border-border bg-white p-5 transition hover:border-emerald-300 hover:bg-emerald-50" to="/register/professional">
          <UserPlus className="h-6 w-6 text-emerald-700" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold">Registrar profesional</h2>
          <p className="mt-1 text-sm text-gray-600">Perfil gratis para siempre, sin suscripcion ni comision OfiAI descontada de tus honorarios.</p>
        </Link>
      </div>

      <Link className="mt-6 inline-flex text-sm font-medium text-gray-700 hover:text-gray-950" to="/login">
        Ya tengo cuenta
      </Link>
    </AuthLayout>
  );
}

/**
 * Formulario de registro de empresas conectado al backend de auth.
 */
function CompanyRegisterPage() {
  const navigate = useNavigate();
  const { registerCompany, loading } = useAuth();
  const [error, setError] = useState('');
  const [form, setForm] = useState<RegisterCompanyInput>({
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    pais: 'AR',
    nombreEmpresa: '',
    industria: '',
    tamanoEmpresa: 'pequena',
    ciudad: '',
    rut: '',
    telefono: '',
  });

  /**
   * Actualiza un campo tipado del formulario de empresa.
   */
  function updateField<K extends keyof RegisterCompanyInput>(field: K, value: RegisterCompanyInput[K]): void {
    setForm(previous => ({ ...previous, [field]: value }));
  }

  /**
   * Registra la empresa y abre su dashboard.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');

    try {
      await registerCompany(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible registrar la empresa.');
    }
  }

  return (
    <AuthLayout>
      <FormHeader title="Registro Empresa" subtitle="Cargá los datos mínimos para publicar trabajos y activar matching IA." />
      <form className="grid gap-3" onSubmit={handleSubmit}>
        <input className="ofi-input" placeholder="Nombre" value={form.nombre} onChange={event => updateField('nombre', event.target.value)} required />
        <input className="ofi-input" placeholder="Apellido o contacto" value={form.apellido} onChange={event => updateField('apellido', event.target.value)} />
        <input className="ofi-input" placeholder="Email" type="email" value={form.email} onChange={event => updateField('email', event.target.value)} required />
        <input className="ofi-input" placeholder="Contraseña" type="password" value={form.password} onChange={event => updateField('password', event.target.value)} required />
        <input className="ofi-input" placeholder="Nombre de la empresa" value={form.nombreEmpresa} onChange={event => updateField('nombreEmpresa', event.target.value)} required />
        <input className="ofi-input" placeholder="Industria" value={form.industria} onChange={event => updateField('industria', event.target.value)} required />
        <div className="grid gap-3 sm:grid-cols-2">
          <select className="ofi-input" value={form.pais} onChange={event => updateField('pais', event.target.value as RegisterCompanyInput['pais'])}>
            <option value="AR">Argentina</option>
            <option value="MX">México</option>
            <option value="CO">Colombia</option>
            <option value="CL">Chile</option>
            <option value="PE">Perú</option>
          </select>
          <select className="ofi-input" value={form.tamanoEmpresa} onChange={event => updateField('tamanoEmpresa', event.target.value as RegisterCompanyInput['tamanoEmpresa'])}>
            <option value="micro">Micro</option>
            <option value="pequena">Pequeña</option>
            <option value="mediana">Mediana</option>
            <option value="grande">Grande</option>
          </select>
        </div>
        <input className="ofi-input" placeholder="Ciudad" value={form.ciudad} onChange={event => updateField('ciudad', event.target.value)} required />
        <input className="ofi-input" placeholder="Teléfono" value={form.telefono} onChange={event => updateField('telefono', event.target.value)} />
        <input className="ofi-input" placeholder="RUT / CUIT / Identificador fiscal" value={form.rut} onChange={event => updateField('rut', event.target.value)} />
        <FeedbackError message={error} />
        <button className="ofi-btn-primary justify-center" type="submit" disabled={loading}>
          {loading ? 'Registrando...' : 'Crear empresa'}
        </button>
      </form>
    </AuthLayout>
  );
}

/**
 * Formulario de registro profesional conectado al backend de auth.
 */
function ProfessionalRegisterPage() {
  const navigate = useNavigate();
  const { registerProfessional, loading } = useAuth();
  const [error, setError] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [categories, setCategories] = useState('');
  const [form, setForm] = useState<Omit<RegisterProfessionalInput, 'especialidades' | 'categorias'>>({
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    pais: 'AR',
    aniosExperiencia: 0,
    ciudad: '',
    tarifaHora: undefined,
    telefono: '',
  });

  /**
   * Actualiza un campo tipado del formulario profesional.
   */
  function updateField<K extends keyof typeof form>(field: K, value: (typeof form)[K]): void {
    setForm(previous => ({ ...previous, [field]: value }));
  }

  /**
   * Registra el profesional y abre su dashboard.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');

    try {
      await registerProfessional({
        ...form,
        especialidades: parseCsv(specialties),
        categorias: parseCsv(categories),
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible registrar el profesional.');
    }
  }

  return (
    <AuthLayout>
      <FormHeader title="Registro Profesional" subtitle="Creá tu perfil, declarando especialidades, ciudad y tarifa de referencia." />
      <form className="grid gap-3" onSubmit={handleSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="ofi-input" placeholder="Nombre" value={form.nombre} onChange={event => updateField('nombre', event.target.value)} required />
          <input className="ofi-input" placeholder="Apellido" value={form.apellido} onChange={event => updateField('apellido', event.target.value)} required />
        </div>
        <input className="ofi-input" placeholder="Email" type="email" value={form.email} onChange={event => updateField('email', event.target.value)} required />
        <input className="ofi-input" placeholder="Contraseña" type="password" value={form.password} onChange={event => updateField('password', event.target.value)} required />
        <input className="ofi-input" placeholder="Especialidades separadas por coma" value={specialties} onChange={event => setSpecialties(event.target.value)} required />
        <input className="ofi-input" placeholder="Categorías separadas por coma" value={categories} onChange={event => setCategories(event.target.value)} required />
        <div className="grid gap-3 sm:grid-cols-3">
          <select className="ofi-input" value={form.pais} onChange={event => updateField('pais', event.target.value as RegisterProfessionalInput['pais'])}>
            <option value="AR">Argentina</option>
            <option value="MX">México</option>
            <option value="CO">Colombia</option>
            <option value="CL">Chile</option>
            <option value="PE">Perú</option>
          </select>
          <input className="ofi-input" placeholder="Ciudad" value={form.ciudad} onChange={event => updateField('ciudad', event.target.value)} required />
          <input className="ofi-input" min="0" placeholder="Años exp." type="number" value={form.aniosExperiencia} onChange={event => updateField('aniosExperiencia', Number(event.target.value))} required />
        </div>
        <input className="ofi-input" min="0" placeholder="Tarifa hora" type="number" value={form.tarifaHora ?? ''} onChange={event => updateField('tarifaHora', event.target.value ? Number(event.target.value) : undefined)} />
        <input className="ofi-input" placeholder="Teléfono" value={form.telefono} onChange={event => updateField('telefono', event.target.value)} />
        <FeedbackError message={error} />
        <button className="ofi-btn-primary justify-center" type="submit" disabled={loading}>
          {loading ? 'Registrando...' : 'Crear perfil profesional'}
        </button>
      </form>
    </AuthLayout>
  );
}

/**
 * Pantalla pública de recuperación de contraseña.
 */
function ForgotPasswordPage() {
  const { recoverPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  /**
   * Solicita el enlace de recuperación al backend.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await recoverPassword(email).catch(() => undefined);
    setMessage('Si el correo existe, vas a recibir un enlace de recuperación.');
  }

  return (
    <AuthLayout>
      <FormHeader title="Recuperar contraseña" subtitle="Ingresá tu email y enviaremos un enlace seguro de recuperación." />
      <form className="space-y-4" onSubmit={handleSubmit}>
        <input className="ofi-input" type="email" placeholder="tu@email.com" value={email} onChange={event => setEmail(event.target.value)} required />
        <button className="ofi-btn-primary w-full justify-center" type="submit">Enviar enlace</button>
      </form>
      {message && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
      <Link className="mt-5 inline-flex text-sm font-medium text-gray-700 hover:text-gray-950" to="/login">Volver al login</Link>
    </AuthLayout>
  );
}

/**
 * Dashboard contextual para empresa, profesional o administrador.
 */
function DashboardPage() {
  const { role, user } = useAuth();
  const dashboard = useApiResource<DashboardData>(dashboardEndpoint(role ?? 'empresa'));
  const jobs = useApiResource<JobData[]>('/jobs?limite=10');
  return (
    <DashboardLayout>
      <PageHeader eyebrow="Dashboard" title={`Hola, ${user?.name ?? 'equipo'}`} description="Actividad de tu cuenta" />
      <ResourceState resource={dashboard} />
      {dashboard.data && <MetricGrid metrics={toMetrics(dashboard.data.kpis)} />}
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title={role === 'profesional' ? 'Oportunidades publicadas' : 'Resumen de trabajos'} action={<Link to="/jobs">Ver todos</Link>}>
          <ResourceState resource={jobs} />
          {jobs.data && <WorkList jobs={jobs.data.map(toJobSummary)} />}
        </Panel>
        <Panel title="Actividad reciente">
          {dashboard.data && <ActivityFeed items={dashboard.data.actividadReciente.map(item => ({
            id: item.id, titulo: item.titulo, detalle: item.descripcion,
            fechaRelativa: new Date(item.fecha).toLocaleString(), tipo: 'trabajo',
          }))} />}
        </Panel>
      </div>
    </DashboardLayout>
  );
}

/** Lista empresas persistidas o el perfil de la empresa autenticada. */
function CompaniesPage() {
  const { role } = useAuth();
  const [page, setPage] = useState(1);
  const own = useApiResource<CompanyData>(role === 'empresa' ? '/companies/me/profile' : null);
  const catalog = useApiResource<CompanyData[]>(
    role === 'admin' ? `/companies?pagina=${page}&limite=20` : null);
  const resource = role === 'empresa' ? own : catalog;
  const companies = role === 'empresa' ? (own.data ? [own.data] : []) : catalog.data ?? [];
  return (
    <DashboardLayout>
      <PageHeader eyebrow="Empresas" title="Cuentas empresa" description="Empresas registradas" />
      <ResourceState resource={resource} />
      <Panel title="Empresas">
        {!resource.loading && !resource.error && companies.length === 0 && <p>No hay empresas registradas.</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead><tr><th>Empresa</th><th>Industria</th><th>Ciudad</th><th>Contrataciones</th><th>Plan</th></tr></thead>
            <tbody>{companies.map(company => <tr key={company.id} className="border-b border-border">
              <td className="py-4">{company.nombreEmpresa}</td><td>{company.industria}</td><td>{company.ciudad}</td>
              <td>{company.totalContrataciones}</td><td>{company.planSuscripcion ?? 'gratuito'}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {role === 'admin' && <div className="mt-4 flex gap-3">
          <button className="ofi-btn-secondary" disabled={catalog.loading || page === 1} onClick={() => setPage(value => value - 1)}>Anterior</button>
          <span>Pagina {page}</span>
          <button className="ofi-btn-secondary" disabled={catalog.loading || !catalog.paginacion || page >= catalog.paginacion.totalPaginas} onClick={() => setPage(value => value + 1)}>Siguiente</button>
        </div>}
      </Panel>
    </DashboardLayout>
  );
}

/** Busca profesionales reales y distingue perfiles sin resenas. */
function ProfessionalsPage() {
  const [query, setQuery] = useState('');
  const resource = useApiResource<ProfessionalData[]>('/professionals?limite=100');
  const filtered = (resource.data ?? []).filter(pro => `${pro.nombre} ${pro.apellido} ${pro.especialidades.join(' ')} ${pro.ciudad}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <DashboardLayout>
      <PageHeader eyebrow="Profesionales" title="Profesionales" description="Directorio de profesionales registrados" />
      <Toolbar icon={<Search className="h-4 w-4" />} value={query} onChange={setQuery} placeholder="Buscar por nombre, oficio o ciudad" />
      <ResourceState resource={resource} />
      {!resource.loading && !resource.error && filtered.length === 0 && <p className="mt-4">No hay profesionales para esta busqueda.</p>}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {filtered.map(pro => <article className="rounded-lg border border-border bg-white p-5" key={pro.id}>
          <h2 className="font-semibold">{pro.nombre} {pro.apellido}</h2>
          <p className="text-sm">{pro.especialidades.join(', ')}</p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{pro.ciudad}</span>
            <span className="inline-flex items-center gap-1"><Star className="h-4 w-4" />{pro.totalResenas > 0 ? pro.calificacionPromedio : 'Sin resenas'}</span>
          </div>
          <p className="mt-4">{pro.disponible ? 'Disponible' : 'No disponible'}</p>
          {pro.verificado && <p>Perfil verificado</p>}
        </article>)}
      </div>
    </DashboardLayout>
  );
}

/** Publica y cancela trabajos mediante la API, sin altas locales. */
function JobsPage() {
  const { role } = useAuth();
  const resource = useApiResource<JobData[]>('/jobs?limite=100');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Mantenimiento');
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [budget, setBudget] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  /** Crea el trabajo y refresca el listado tras confirmar la persistencia. */
  async function handleAddJob(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    const selectedCategory = (category === '__custom__' ? customCategory : category).trim();
    if (!selectedCategory) {
      setError('Escribí una categoría para el trabajo.');
      return;
    }
    setPending(true);
    setError('');
    try {
      await api.post('/jobs', { titulo: title.trim(), descripcion: description.trim(), categoria: selectedCategory,
        ciudad: city.trim(), tipoTrabajo: 'presencial', moneda: 'ARS',
        ...(budget ? { presupuestoMaximo: Number(budget) } : {}) });
      setTitle(''); setDescription(''); setBudget('');
      resource.reload();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setPending(false); }
  }

  /** Cancela un trabajo propio y espera la confirmacion del servidor. */
  async function cancelJob(id: string): Promise<void> {
    if (!window.confirm('Cancelar este trabajo?')) return;
    setPending(true); setError('');
    try { await api.delete(`/jobs/${id}`); resource.reload(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setPending(false); }
  }

  return (
    <DashboardLayout>
      <PageHeader eyebrow="Trabajos" title="Gestion de solicitudes" description="Trabajos publicados" />
      {role === 'empresa' && <Link className="ofi-btn-primary mb-5" to="/dashboard/company/ai-request"><Sparkles className="h-4 w-4" />Crear solicitud con IA</Link>}
      {error && <FeedbackError message={error} />}
      <div className="grid gap-6 xl:grid-cols-2">
        {role === 'empresa' && <Panel title="Publicar trabajo">
          <form className="space-y-3" onSubmit={event => void handleAddJob(event)}>
            <label className="block">Titulo<input className="ofi-input" minLength={5} value={title} onChange={event => setTitle(event.target.value)} required /></label>
            <label className="block">Descripcion<textarea className="ofi-input" minLength={20} value={description} onChange={event => setDescription(event.target.value)} required /></label>
            <div>
              <label className="block" htmlFor="job-category">Categoría</label>
              <select id="job-category" className="ofi-input" value={category} onChange={event => setCategory(event.target.value)}>
              {JOB_CATEGORY_GROUPS.map(group => <optgroup label={group.label} key={group.label}>
                {group.categories.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}
              </optgroup>)}
              <option value="__custom__">Otra categoría</option>
              </select>
            </div>
            {category === '__custom__' && <label className="block">Categoría personalizada
              <input className="ofi-input" value={customCategory} onChange={event => setCustomCategory(event.target.value)} required />
            </label>}
            <label className="block">Ciudad<input className="ofi-input" value={city} onChange={event => setCity(event.target.value)} required /></label>
            <label className="block">Presupuesto maximo (ARS)<input className="ofi-input" type="number" min="1" value={budget} onChange={event => setBudget(event.target.value)} /></label>
            <button className="ofi-btn-primary" disabled={pending} type="submit"><Plus className="h-4 w-4" />{pending ? 'Publicando...' : 'Publicar'}</button>
          </form>
        </Panel>}
        <Panel title="Trabajos recientes">
          <ResourceState resource={resource} />
          {resource.data && <WorkList jobs={resource.data.map(toJobSummary)} />}
          {role !== 'profesional' && resource.data?.filter(job => !['completado', 'cancelado'].includes(job.estado)).map(job =>
            <button className="ofi-btn-secondary mt-2 mr-2" key={job.id} disabled={pending} onClick={() => void cancelJob(job.id)}>Cancelar: {job.titulo}</button>)}
        </Panel>
      </div>
    </DashboardLayout>
  );
}

/**
 * Vista de chat IA y clasificación asistida.
 */
function AiPage() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'm-1', author: 'ia', text: 'Soy el asistente OfiAI. Puedo ayudarte a clasificar solicitudes, priorizar trabajos o preparar un ranking de profesionales.' },
  ]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * Envía el mensaje al backend de IA y registra una respuesta segura si no hay conexión.
   */
  async function handleSend(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (loading || !prompt.trim()) {
      return;
    }

    const userMessage: ChatMessage = { id: `m-${Date.now()}`, author: 'usuario', text: prompt };
    setMessages(previous => [...previous, userMessage]);
    setPrompt('');
    setLoading(true);

    try {
      const response = await enviarMensajeIa({ mensaje: userMessage.text }, token ?? undefined);
      setMessages(previous => [...previous, { id: `m-${Date.now()}-ia`, author: 'ia', text: response.respuesta }]);
    } catch {
      setMessages(previous => [...previous, {
        id: `m-${Date.now()}-error`,
        author: 'ia',
        text: 'No se pudo consultar el asistente. Revisa la conexion e intenta de nuevo.',
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <PageHeader
        eyebrow="Inteligencia Artificial"
        title="Asistente OfiAI"
        description="Chat operativo preparado para reglas internas y mejora progresiva con Gemini."
      />
      <Panel title="Chat IA" action={<MessageSquare className="h-5 w-5 text-brand-700" />}>
        <div className="space-y-3">
          {messages.map(message => (
            <div
              className={`max-w-3xl rounded-lg px-4 py-3 text-sm ${message.author === 'ia' ? 'bg-surface-secondary text-gray-800' : 'ml-auto bg-brand-600 text-white'}`}
              key={message.id}
            >
              {message.text}
            </div>
          ))}
        </div>
        <form className="mt-5 flex gap-2" onSubmit={handleSend}>
          <input className="ofi-input" placeholder="Ej: clasificá esta solicitud de mantenimiento..." value={prompt} onChange={event => setPrompt(event.target.value)} />
          <button className="ofi-btn-primary" type="submit" disabled={loading} aria-label="Enviar mensaje" title="Enviar mensaje">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </Panel>
    </DashboardLayout>
  );
}

/**
 * Vista de planes y checkout con Mercado Pago.
 */
function SubscriptionsPage() {
  const { role, user } = useAuth();
  const personal = user?.accountType === 'particular';
  const freeAccount = personal || role === 'profesional';
  const available = useApiResource<PlanData[]>(role ? '/subscriptions/plans' + (role === 'admin' ? '' : '?audience=' + (personal ? 'particular' : role)) : null);
  const current = useApiResource<SubscriptionData | null>('/subscriptions/me');
  const history = useApiResource<{ eventos: Array<{ id: string; descripcion: string }> }>('/subscriptions/history');
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);

  /** Solicita un checkout real para el plan elegido. */
  async function handleSubscribe(plan: PlanSuscripcion): Promise<void> {
    if (pending) return;
    const selected = available.data?.find(item => item.id === plan);
    if (!selected?.available) return;
    const expectedPriceMinor = selected.precioMensual === null ? undefined : Math.round(selected.precioMensual * 100);
    const change = current.data && current.data.plan !== 'gratuito' && current.data.estado === 'activa';
    const terms = selected.priceUsd === 0 ? 'Plan FREE.' : selected.moneda + ' ' + selected.precioMensual?.toLocaleString()
      + ' por mes, con renovacion automatica hasta que canceles.';
    if (!window.confirm(terms + (change ? ' El cambio se aplicara al siguiente ciclo, sin prorrateo inmediato.' : ' Continuar al checkout?'))) return;
    setPending(true); setStatus('');
    try {
      if (change) {
        await api.post('/subscriptions/' + current.data!.id + '/change-plan', { plan, expectedPriceMinor });
        setStatus('Cambio programado para el siguiente periodo confirmado.');
        current.reload(); history.reload(); return;
      }
      const response = await api.post<ApiEnvelope<{ checkout: { url?: string; estado: string } }>>('/subscriptions/checkout', {
        plan, expectedPriceMinor, successUrl: `${window.location.origin}/subscriptions/success`, cancelUrl: `${window.location.origin}/subscriptions`,
      });
      const checkout = response.datos?.checkout;
      if (checkout?.url) { window.location.assign(checkout.url); return; }
      setStatus(checkout?.estado === 'no_requiere_pago' ? 'Plan gratuito activado.' : 'El checkout no esta disponible en este momento.');
      current.reload(); history.reload();
    } catch (error) { setStatus(errorMessage(error)); available.reload(); }
    finally { setPending(false); }
  }

  return (
    <DashboardLayout>
      <PageHeader eyebrow={freeAccount ? 'Mi cuenta' : 'Suscripciones'} title={freeAccount ? 'Gratis para siempre' : 'Planes OfiAI'}
        description={freeAccount ? 'Sin cuota mensual' : 'Suscripcion mensual con renovacion automatica'} />
      {freeAccount && <p className="mb-4">{personal ? 'Se suma un 10% al contratante por contratacion efectiva en OfiAI.' : 'Tu perfil y tus propuestas son gratuitos. OfiAI no descuenta su comision de tus honorarios.'}</p>}
      <ResourceState resource={available} />
      <ResourceState resource={current} />
      {current.data && <p className="mb-4">Plan {available.data?.find(plan => plan.id === current.data?.plan)?.nombre ?? current.data.plan}: {current.data.estado}. Renovacion automatica: {current.data.renovacionAutomatica ? 'si' : 'no'}.</p>}
      {current.data === null && !freeAccount && <p className="mb-4">Todavia no tenes una suscripcion.</p>}
      <SubscriptionBillingPanel onChanged={() => { current.reload(); history.reload(); }} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {available.data?.map((plan, index) => <article className={['bg-sky-50', 'bg-emerald-50', 'bg-violet-50', 'bg-rose-50'][index % 4] + ' flex min-w-0 flex-col rounded-lg border border-border p-5'} key={plan.audience + plan.id}>
          <Banknote className="h-5 w-5 text-emerald-700" />
          <h2 className="mt-3 text-lg font-semibold">{plan.nombre}</h2>
          {role === 'admin' && <p className="text-sm">{plan.audience}</p>}
          <p className="mt-4 text-2xl">{plan.audience !== 'empresa' ? 'Gratis para siempre' : <>US$ {plan.priceUsd}<span className="text-sm">/mes</span></>}</p>
          {plan.priceUsd > 0 && <p className="mt-2 text-sm">{plan.precioMensual !== null
            ? plan.moneda + ' ' + plan.precioMensual.toLocaleString() + ' por mes' : 'Importe local pendiente de configuracion'}</p>}
          {plan.exchangeRate && <p className="mt-2 text-sm text-muted">1 USD = {plan.exchangeRate.rate.toLocaleString()} ARS.
            {' '}{plan.exchangeRate.source === 'mercadopago' ? 'Mercado Pago' : 'Cotizacion configurada'} · {new Date(plan.exchangeRate.asOf).toLocaleDateString()}</p>}
      <ul className="my-4 flex-1 space-y-2">{Object.entries(plan.audience === 'profesional' ? plan.limitesProfesional : plan.limitesEmpresa)
        .filter(([key]) => key === 'trabajosPublicados' || key === 'propuestasEnviadas').map(([key, value]) =>
            <li key={key}>{metricLabel(key)}: {value === -1 ? 'Sin limite' : value}</li>)}</ul>
          {role !== 'admin' && !freeAccount && <button className="ofi-btn-primary mt-4" disabled={pending || !plan.available || (current.data?.plan === plan.id && current.data.estado === 'activa')}
            onClick={() => void handleSubscribe(plan.id)}>{current.data?.plan === plan.id && current.data.estado === 'activa'
              ? 'Plan actual' : plan.available ? 'Elegir ' + plan.nombre : 'Contratacion no disponible'}</button>}
        </article>)}
      </div>
      {status && <p role="status" className="mt-4">{status}</p>}
      <Panel title="Historial">
        <ResourceState resource={history} />
        {history.data?.eventos.length === 0 && <p>No hay movimientos.</p>}
        {history.data?.eventos.map(event => <p className="py-2" key={event.id}>{event.descripcion}</p>)}
      </Panel>
    </DashboardLayout>
  );
}

/** Consulta el estado real despues del retorno del proveedor de pagos. */
function SubscriptionSuccessPage() {
  const current = useApiResource<SubscriptionData | null>('/subscriptions/me');
  return <DashboardLayout><Panel title="Estado de suscripcion">
    <ResourceState resource={current} />
    {!current.loading && !current.error && <p>{current.data?.estado === 'activa' ? 'Tu suscripcion esta activa.' : 'La confirmacion del pago esta pendiente.'}</p>}
    <button className="ofi-btn-secondary mt-4" onClick={current.reload}>Actualizar estado</button>
  </Panel></DashboardLayout>;
}

/** Muestra analytics global solo a administradores y metricas propias al resto. */
function AnalyticsPage() {
  const { role } = useAuth();
  const kpis = useApiResource<Record<string, number>>(role === 'admin' ? '/analytics/kpis' : null);
  const own = useApiResource<DashboardData>(role !== 'admin' ? dashboardEndpoint(role ?? 'empresa') : null);
  const usage = useApiResource<UsageData>(role === 'admin' ? '/analytics/usage' : null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const values = role === 'admin' ? kpis.data : own.data?.metricas;

  /** Genera y descarga el CSV autentico del reporte mensual. */
  async function exportReport(): Promise<void> {
    setPending(true); setError('');
    try {
      const report = await api.post<ApiEnvelope<{ id: string }>>('/analytics/reports', { periodo: 'mensual' });
      if (!report.datos) throw new Error('No se pudo generar el reporte.');
      const exported = await getData<{ contenido: string; nombreArchivo: string }>(`/analytics/reports/${report.datos.id}/export?formato=csv`);
      const url = URL.createObjectURL(new Blob([exported.contenido], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = exported.nombreArchivo; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setPending(false); }
  }
  return <DashboardLayout>
    <PageHeader eyebrow="Analytics" title="Metricas y reportes" description={role === 'admin' ? 'Actividad de la plataforma' : 'Actividad de tu cuenta'} />
    <ResourceState resource={role === 'admin' ? kpis : own} />
    {values && <MetricGrid metrics={toMetrics(values)} />}
    {error && <FeedbackError message={error} />}
    {role === 'admin' && <Panel title="Uso de la plataforma" action={<button className="ofi-btn-secondary" disabled={pending} onClick={() => void exportReport()}><Download className="h-4 w-4" />Exportar CSV</button>}>
      <ResourceState resource={usage} />
      {usage.data && Object.entries(usage.data).map(([group, entries]) => <div className="py-4" key={group}>
        <h2 className="font-semibold">{metricLabel(group)}</h2>
        {Object.entries(entries as Record<string, number>).length === 0 && <p>Sin eventos.</p>}
        {Object.entries(entries as Record<string, number>).map(([label, value]) => <p key={label}>{metricLabel(label)}: {value}</p>)}
      </div>)}
    </Panel>}
  </DashboardLayout>;
}

/** Persiste preferencias de notificacion de la cuenta autenticada. */
function SettingsPage() {
  const account = useApiResource<AccountData>('/auth/me');
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const preferences = draft ?? account.data?.usuario.preferenciasNotificaciones ?? { email: true, whatsapp: true, push: true, in_app: true };
  /** Guarda las preferencias en el backend. */
  async function save(): Promise<void> {
    setPending(true); setMessage('');
    try { await api.put('/auth/preferences', preferences); setMessage('Preferencias guardadas.'); account.reload(); }
    catch (failure) { setMessage(errorMessage(failure)); }
    finally { setPending(false); }
  }
  return <DashboardLayout>
    <PageHeader eyebrow="Configuracion" title="Preferencias de cuenta" description="Perfil y notificaciones" />
    <ResourceState resource={account} />
    {account.data && <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Perfil">
        <p>{account.data.usuario.nombre} {account.data.usuario.apellido}</p>
        <p>{account.data.usuario.email}</p><p>{account.data.usuario.rol}</p>
        {account.data.usuario.rol==='profesional'&&<SettlementAccountForm/>}
      </Panel>
      <Panel title="Notificaciones">
        {(Object.keys(preferences) as Array<keyof NotificationPreferences>).map(key =>
          <label className="flex items-center justify-between py-3" key={key}>
            <span>{key === 'in_app' ? 'Internas' : metricLabel(key)}</span>
            <input type="checkbox" checked={preferences[key]} onChange={event => setDraft({ ...preferences, [key]: event.target.checked })} />
          </label>)}
        <button className="ofi-btn-primary mt-3" disabled={pending} onClick={() => void save()}>Guardar</button>
        {message && <p role="status">{message}</p>}
      </Panel>
    </div>}
  </DashboardLayout>;
}

/** Administra usuarios y metricas obtenidos de endpoints protegidos. */
function AdminPage() {
  const { user } = useAuth();
  const metrics = useApiResource<Record<string, number>>('/admin/metrics');
  const users = useApiResource<AdminUserData[]>('/admin/users');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  /** Actualiza el estado de una cuenta con confirmacion explicita. */
  async function changeStatus(account: AdminUserData): Promise<void> {
    if (!window.confirm(`${account.activo ? 'Suspender' : 'Reactivar'} a ${account.email}?`)) return;
    setPending(account.id); setError('');
    try { await api.patch(`/admin/users/${account.id}/status`, { activo: !account.activo }); users.reload(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setPending(null); }
  }
  return <DashboardLayout>
    <PageHeader eyebrow="Administrador" title="Centro de control" description="Usuarios y actividad de la plataforma" />
    <ResourceState resource={metrics} />
    {metrics.data && <MetricGrid metrics={toMetrics(metrics.data)} />}
    {error && <FeedbackError message={error} />}
    <Panel title="Usuarios recientes">
      <ResourceState resource={users} />
      {users.data?.length === 0 && <p>No hay usuarios.</p>}
      {users.data?.map(account => <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-4" key={account.id}>
        <div><p>{account.nombre}</p><p className="text-sm break-all">{account.email} · {account.rol}</p></div>
        <button className="ofi-btn-secondary" disabled={pending !== null || account.id === user?.id} onClick={() => void changeStatus(account)}>
          {account.activo ? 'Suspender' : 'Reactivar'}
        </button>
      </div>)}
    </Panel>
  </DashboardLayout>;
}

/** Lee notificaciones y persiste la marca de lectura. */
function NotificationsPage() {
  const resource = useApiResource<NotificationData[]>('/notifications');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  /** Marca la notificacion como leida despues de confirmacion del servidor. */
  async function markRead(id: string): Promise<void> {
    setPending(id); setError('');
    try { await api.post(`/notifications/${id}/read`, {}); resource.reload(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setPending(null); }
  }
  return <DashboardLayout><PageHeader eyebrow="Notificaciones" title="Notificaciones" description="Actividad de tu cuenta" />
    <ResourceState resource={resource} />
    {error && <FeedbackError message={error} />}
    {!resource.loading && !resource.error && resource.data?.length === 0 && <p>No tenes notificaciones.</p>}
    {resource.data?.map(item => <div className="border-b border-border py-4" key={item.id}>
      <h2 className="font-semibold">{item.titulo}</h2><p>{item.mensaje}</p>
      {!item.leida && <button className="ofi-btn-secondary mt-2" disabled={pending !== null} onClick={() => void markRead(item.id)}>Marcar como leida</button>}
    </div>)}
  </DashboardLayout>;
}

/** Muestra estados de carga y error con una accion de reintento. */
function ResourceState({ resource }: { resource: { loading: boolean; error: string; reload: () => void } }) {
  if (resource.loading) return <p role="status" className="py-4">Cargando...</p>;
  if (resource.error) return <div className="py-4"><FeedbackError message={resource.error} /><button className="ofi-btn-secondary" onClick={resource.reload}>Reintentar</button></div>;
  return null;
}

/** Extrae mensajes seguros para la interfaz. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo completar la operacion.';
}

/**
 * Encabezado reutilizable para formularios públicos.
 */
function FormHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <Link className="text-sm font-semibold text-brand-700" to="/login">OfiAI</Link>
      <h1 className="mt-2 text-3xl font-bold text-gray-950">{title}</h1>
      <p className="mt-2 text-sm text-gray-600">{subtitle}</p>
    </div>
  );
}

/**
 * Renderiza un mensaje de error cuando existe contenido.
 */
function FeedbackError({ message }: { message: string }) {
  if (!message) {
    return null;
  }

  return (
    <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

/**
 * Encabezado estándar de páginas internas.
 */
function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="ofi-page-header mb-6 flex items-start justify-between gap-4 pb-5">
      <div>
        <p className="ofi-page-eyebrow text-xs font-semibold uppercase">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-950">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600">{description}</p>
      </div>
      <Sparkles className="ofi-page-symbol h-10 w-10 shrink-0 rounded-lg p-2" aria-hidden="true" />
    </div>
  );
}

/**
 * Seccion abierta reutilizable para bloques de dashboard.
 */
function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="ofi-panel min-w-0 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-950">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * Grilla de KPIs de alto nivel.
 */
function MetricGrid({ metrics }: { metrics: KpiDashboard[] }) {
  return (
    <div className="ofi-metric-grid grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {metrics.map(metric => (
        <article className="ofi-metric min-w-0 rounded-lg border p-4 sm:p-5" key={metric.etiqueta}>
          <div className="flex items-center justify-between gap-3">
            <p className="min-h-10 text-sm font-medium text-gray-700">{metric.etiqueta}</p>
            <TrendingUp className={`ofi-metric-icon hidden h-5 w-5 shrink-0 sm:block ${metric.tono === 'alerta' ? 'text-amber-700' : ''}`} aria-hidden="true" />
          </div>
          <p className="mt-3 break-words text-3xl font-bold tabular-nums text-gray-950">{metric.valor}</p>
          {metric.variacion && <p className={`mt-1 text-sm ${metric.tono === 'alerta' ? 'text-amber-700' : metric.tono === 'positivo' ? 'text-emerald-700' : 'text-gray-500'}`}>
            {metric.variacion}
          </p>}
        </article>
      ))}
    </div>
  );
}

/**
 * Lista compacta de trabajos.
 */
function WorkList({ jobs }: { jobs: TrabajoResumen[] }) {
  const { user } = useAuth();
  if (jobs.length === 0) return <p className="py-4">No hay trabajos para mostrar.</p>;
  return (
    <div className="divide-y divide-border">
      {jobs.map(job => (
        <div className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_120px_120px]" key={job.id}>
          <div>
            <p className="font-medium text-gray-950">{job.titulo}</p>
            <p className="mt-1 text-sm text-gray-500">{job.categoria} · {job.ciudad}</p>
          </div>
          <StatusBadge status={job.estado} />
          <div className="text-sm font-semibold text-brand-700">{job.compatibilidadIa === undefined ? '' : `${job.compatibilidadIa}% IA`}
            {user?.role === 'empresa' && !['cancelado', 'completado'].includes(job.estado) &&
              <Link className="mt-1 flex items-center gap-1" to={'/dashboard/company/jobs/' + encodeURIComponent(job.id) + '/matches'}><Sparkles size={14} />Ver candidatos</Link>}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Badge de estado para trabajos.
 */
function StatusBadge({ status }: { status: TrabajoResumen['estado'] }) {
  const label: Record<TrabajoResumen['estado'], string> = {
    borrador: 'Borrador',
    en_revision: 'En revision',
    publicado: 'Publicado',
    en_progreso: 'En progreso',
    completado: 'Completado',
    cancelado: 'Cancelado',
  };

  const tone: Record<TrabajoResumen['estado'], string> = {
    borrador: 'bg-gray-50 text-gray-700',
    en_revision: 'bg-blue-50 text-blue-700',
    publicado: 'bg-blue-50 text-blue-700',
    en_progreso: 'bg-amber-50 text-amber-700',
    completado: 'bg-emerald-50 text-emerald-700',
    cancelado: 'bg-red-50 text-red-700',
  };

  return <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${tone[status]}`}>{label[status]}</span>;
}

/**
 * Lista de actividad reciente del sistema.
 */
function ActivityFeed({ items }: { items: ActividadReciente[] }) {
  if (items.length === 0) return <p>Sin actividad reciente.</p>;
  return (
    <div className="space-y-4">
      {items.map(item => (
        <div className="flex gap-3" key={item.id}>
          <Clock3 className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-gray-950">{item.titulo}</p>
            <p className="text-sm text-gray-600">{item.detalle}</p>
            <p className="mt-1 text-xs text-gray-400">{item.fechaRelativa}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Barra de búsqueda reutilizable para listados.
 */
function Toolbar({
  icon,
  value,
  onChange,
  placeholder,
}: {
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-white px-4 py-3 shadow-sm">
      <span className="text-gray-400">{icon}</span>
      <input
        className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
        placeholder={placeholder}
        value={value}
        onChange={event => onChange(event.target.value)}
      />
    </div>
  );
}

/**
 * Convierte texto separado por comas en un arreglo limpio.
 */
function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}
