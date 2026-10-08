/**
 * @archivo DashboardLayout.tsx
 * @descripcion Layout principal para los dashboards de OfiAI.
 * Incluye sidebar de navegación, header y área de contenido.
 * Se adapta según el rol del usuario (empresa/profesional/admin).
 * @modulo Layouts
 */
import { type ReactNode, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CalendarCheck,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth, type UserRole } from '../context/AuthContext';
import { useApiResource } from '../lib/api/resources';
import type { SubscriptionData } from '../../../shared/contracts';

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavigationItem {
  label: string;
  path: string;
  icon: LucideIcon;
  roles: UserRole[];
}

const navigationItems: NavigationItem[] = [
  { label: 'Operaciones', path: '/operations/support', icon: Sparkles, roles: ['empresa', 'profesional', 'admin'] },
  { label: 'Solicitud con IA', path: '/dashboard/company/ai-request', icon: Sparkles, roles: ['empresa'] },
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['empresa', 'profesional', 'admin'] },
  { label: 'Notificaciones', path: '/notifications', icon: Bell, roles: ['empresa', 'profesional', 'admin'] },
  { label: 'Empresas', path: '/companies', icon: Building2, roles: ['empresa', 'admin'] },
  { label: 'Profesionales', path: '/professionals', icon: Users, roles: ['empresa', 'profesional', 'admin'] },
  { label: 'Trabajos', path: '/jobs', icon: Briefcase, roles: ['empresa', 'profesional', 'admin'] },
  { label: 'Coordinacion', path: '/dashboard/coordination', icon: CalendarCheck, roles: ['empresa', 'profesional'] },
  { label: 'IA', path: '/ai', icon: Sparkles, roles: ['empresa', 'profesional', 'admin'] },
  { label: 'Suscripciones', path: '/subscriptions', icon: CreditCard, roles: ['empresa', 'profesional', 'admin'] },
  { label: 'Analytics', path: '/analytics', icon: BarChart3, roles: ['empresa', 'profesional', 'admin'] },
  { label: 'Configuración', path: '/settings', icon: Settings, roles: ['empresa', 'profesional', 'admin'] },
  { label: 'Admin', path: '/admin', icon: ShieldCheck, roles: ['admin'] },
  { label: 'Cobros y liquidaciones', path: '/admin/settlements', icon: CreditCard, roles: ['admin'] },
];

/**
 * Filtra la navegación según el rol autenticado.
 */
function getNavigationForRole(role: UserRole | null): NavigationItem[] {
  return navigationItems.filter(item => role && item.roles.includes(role));
}

/**
 * Devuelve una etiqueta legible para el rol del usuario.
 */
function formatRole(role: UserRole | null, accountType?: string, financialRole?: 'OWNER'): string {
  if (role === 'admin' && financialRole === 'OWNER') return 'OWNER';
  if (accountType === 'particular') return 'Particular';
  if (role === 'empresa') {
    return 'Empresa';
  }

  if (role === 'profesional') {
    return 'Profesional';
  }

  if (role === 'admin') {
    return 'Administrador';
  }

  return 'Invitado';
}

/**
 * Calcula el título de la vista actual desde la ruta activa.
 */
function getPageTitle(pathname: string): string {
  if (/^\/dashboard\/company\/jobs\/[^/]+\/pricing$/.test(pathname)) return 'Estimacion';
  if (/^\/dashboard\/company\/jobs\/[^/]+\/matches$/.test(pathname)) return 'Candidatos';
  const activeItem = navigationItems
    .filter(item => pathname === item.path || pathname.startsWith(`${item.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];

  return activeItem?.label ?? 'OfiAI';
}

/**
 * Renderiza un enlace de navegación de dashboard con icono.
 */
function NavigationButton({
  item,
  onNavigate,
}: {
  item: NavigationItem;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      end={item.path === '/dashboard'}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          'ofi-nav-link flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
          isActive
            ? 'ofi-nav-link-active'
            : 'text-gray-600 hover:text-gray-950',
        ].join(' ')
      }
      title={item.label}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{item.label}</span>
    </NavLink>
  );
}

/**
 * Layout del dashboard autenticado.
 */
export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, role, logout } = useAuth();
  const subscription = useApiResource<SubscriptionData | null>(role !== 'admin' ? '/subscriptions/me' : null);
  const location = useLocation();
  const navigate = useNavigate();
  const freeAccount = role === 'profesional' || user?.accountType === 'particular';
  const navigation = getNavigationForRole(role)
    .filter(item => user?.accountType !== 'particular' || item.path !== '/companies')
    .map(item => item.path === '/subscriptions' && freeAccount ? { ...item, label: 'Mi cuenta gratuita' } : item);
  const title = getPageTitle(location.pathname);

  /**
   * Cierra la sesión y devuelve al login.
   */
  async function handleLogout(): Promise<void> {
    await logout();
    navigate('/login');
  }

  return (
    <div className="ofi-workspace min-h-screen text-gray-950" data-view={location.pathname.split('/')[1]} data-role={role}>
      <aside className="ofi-sidebar fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border lg:flex lg:flex-col">
        <div className="border-b border-border p-5">
          <div className="text-2xl font-bold text-brand-700">OfiAI</div>
          <p className="mt-1 text-xs text-gray-500">Operación inteligente</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navigation.map(item => (
            <NavigationButton key={item.path} item={item} />
          ))}
        </nav>
        {role !== 'admin' && <div className="border-t border-border p-4">
          <div className="ofi-plan-summary rounded-lg p-3">
            <p className="text-xs font-medium uppercase text-gray-500">{freeAccount ? 'Mi cuenta' : 'Suscripcion'}</p>
            <p className="mt-1 text-sm font-semibold capitalize text-gray-950">
              {freeAccount ? 'Gratis para siempre' : subscription.loading ? 'Cargando...' : subscription.error ? 'No disponible' : subscription.data ? `${subscription.data.plan}: ${subscription.data.estado}` : 'Sin suscripcion'}
            </p>
          </div>
        </div>}
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden">
          <aside className="ofi-sidebar h-full w-72 max-w-[calc(100%_-_2rem)] overflow-y-auto shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <div className="text-xl font-bold text-brand-700">OfiAI</div>
              <button
                type="button"
                className="rounded-lg p-2 text-gray-600 hover:bg-surface-tertiary"
                aria-label="Cerrar navegación"
                title="Cerrar navegación"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <nav className="space-y-1 p-3">
              {navigation.map(item => (
                <NavigationButton
                  key={item.path}
                  item={item}
                  onNavigate={() => setMobileMenuOpen(false)}
                />
              ))}
            </nav>
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="ofi-topbar sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-gray-600 hover:bg-surface-tertiary lg:hidden"
              aria-label="Abrir navegación"
              title="Abrir navegación"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase text-gray-500">{formatRole(role, user?.accountType, user?.financialRole)}</p>
              <h1 className="truncate text-lg font-semibold text-gray-950 sm:text-xl">{title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="relative rounded-lg p-2 text-gray-600 hover:bg-surface-tertiary"
              aria-label="Ver notificaciones"
              onClick={() => navigate('/notifications')}
              title="Ver notificaciones"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="hidden items-center gap-2 rounded-lg border border-border px-3 py-2 sm:flex">
              <UserRound className="h-4 w-4 text-gray-500" aria-hidden="true" />
              <div className="max-w-[180px]">
                <p className="truncate text-sm font-medium text-gray-950">{user?.name ?? 'Usuario'}</p>
                <p className="truncate text-xs text-gray-500">{user?.email ?? 'sesión activa'}</p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg p-2 text-gray-600 hover:bg-red-50 hover:text-red-700"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              onClick={() => void handleLogout()}
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>

        <main className="ofi-workspace-content mx-auto min-h-[calc(100vh-4rem)] max-w-screen-2xl p-4 sm:p-6 lg:p-8">
          {user?.id.startsWith("demo-") && (
            <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="note">
              <strong>Demo del hackatón</strong> · Datos ficticios · Solo lectura. Las acciones sobre cuentas, pagos e IA requieren una cuenta real.
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
};
