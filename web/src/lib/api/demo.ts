import type { CompanyData, DashboardData, JobData, ProfessionalData, Role } from '../../../../shared/contracts';
import { configuracion } from '../config';

/** Accesos publicos de demostracion. Estas contrasenas no autorizan el backend. */
export const DEMO_ACCOUNTS = [
  { role: 'profesional', email: 'profesional@demo.ofiai.local', password: 'OfiAI-Pro-2026!' },
  { role: 'empresa', email: 'empresa@demo.ofiai.local', password: 'OfiAI-Empresa-2026!' },
  { role: 'admin', email: 'admin@demo.ofiai.local', password: 'OfiAI-Admin-2026!' },
] as const;

/** Conserva el login real y valida los accesos publicos solo cuando el demo esta habilitado. */
export function authenticateDemo(email: string, password: string): Role | null {
  const account = DEMO_ACCOUNTS.find(item => item.email === email.trim().toLowerCase());
  if (!account) return null;
  if (!configuracion.app?.demoAccessEnabled) throw new Error('El acceso demo está deshabilitado.');
  if (account.password !== password) throw new Error('Email o contraseña de demo incorrectos.');
  return account.role;
}

/** Reconoce solamente los tres tokens sinteticos definidos por el acceso demo. */
export function demoRole(token: string | null | undefined): Role | null {
  if (!token?.startsWith('demo-token-')) return null;
  if (!configuracion.app?.demoAccessEnabled) throw new Error('El acceso demo está deshabilitado.');
  const account = DEMO_ACCOUNTS.find(item => token === 'demo-token-' + item.role);
  if (!account) throw new Error('Sesión demo inválida.');
  return account.role;
}

/** Ejemplos ficticios para el hackaton; no representan actividad comercial real. */
const jobs: JobData[] = [
  { id: 'demo-job-1', empresaId: 'demo-empresa', titulo: 'Instalación eléctrica de oficina', descripcion: 'Ejemplo ficticio: revisión e instalación de circuitos.', categoria: 'Electricidad', estado: 'publicado', ciudad: 'Santa Rosa', presupuestoMaximo: 180000, moneda: 'ARS', tipoTrabajo: 'presencial' },
  { id: 'demo-job-2', empresaId: 'demo-empresa', titulo: 'Mantenimiento de equipos de climatización', descripcion: 'Ejemplo ficticio: mantenimiento preventivo.', categoria: 'Climatización', estado: 'en_progreso', ciudad: 'Santa Rosa', presupuestoMaximo: 120000, moneda: 'ARS', tipoTrabajo: 'presencial' },
  { id: 'demo-job-3', empresaId: 'demo-empresa', titulo: 'Reparación de cañería de cocina', descripcion: 'Ejemplo ficticio: reparación de una pérdida.', categoria: 'Plomería', estado: 'completado', ciudad: 'General Pico', presupuestoMaximo: 85000, moneda: 'ARS', tipoTrabajo: 'presencial' },
  { id: 'demo-job-4', empresaId: 'demo-empresa', titulo: 'Pintura de sala de reuniones', descripcion: 'Ejemplo ficticio: preparación y pintura interior.', categoria: 'Pintura', estado: 'publicado', ciudad: 'Santa Rosa', presupuestoMaximo: 150000, moneda: 'ARS', tipoTrabajo: 'presencial' },
];
const companies: CompanyData[] = [{ id: 'demo-empresa', nombreEmpresa: 'OfiAI Empresa Demo', industria: 'Servicios', ciudad: 'Santa Rosa', totalContrataciones: 1, planSuscripcion: 'gratuito', suscripcionActiva: false, activo: true }];
const professionals: ProfessionalData[] = [
  { id: 'demo-profesional', nombre: 'Profesional', apellido: 'Demo', especialidades: ['Electricidad'], ciudad: 'Santa Rosa', calificacionPromedio: 0, totalResenas: 0, disponible: true, verificado: false },
  { id: 'demo-profesional-2', nombre: 'Técnico', apellido: 'de ejemplo', especialidades: ['Climatización'], ciudad: 'Santa Rosa', calificacionPromedio: 0, totalResenas: 0, disponible: true, verificado: false },
];
const activity: DashboardData['actividadReciente'] = [
  { id: 'demo-activity-1', tipo: 'trabajo', titulo: 'Solicitud publicada', descripcion: 'Ejemplo: instalación eléctrica de oficina.', fecha: '2026-10-08T12:00:00-03:00' },
  { id: 'demo-activity-2', tipo: 'trabajo', titulo: 'Trabajo en progreso', descripcion: 'Ejemplo: mantenimiento de climatización.', fecha: '2026-10-07T15:30:00-03:00' },
  { id: 'demo-activity-3', tipo: 'trabajo', titulo: 'Trabajo completado', descripcion: 'Ejemplo: reparación de cañería.', fecha: '2026-10-06T10:00:00-03:00' },
];
const kpis: Record<Role, DashboardData['kpis']> = {
  empresa: { trabajosTotales: 4, trabajosActivos: 3, trabajosCompletados: 1, propuestasRecibidas: 5, contratacionesTotales: 1, calificacionPromedio: 0, suscripcionActiva: false },
  profesional: { trabajosAsignados: 2, trabajosCompletados: 1, propuestasEnviadas: 3, propuestasAceptadas: 2, calificacionPromedio: 0, disponible: true, verificado: false },
  admin: { usuariosTotales: 4, empresasActivas: 1, profesionalesActivos: 2, trabajosTotales: 4, trabajosActivos: 3, suscripcionesActivas: 0, ingresosMensualesEstimados: 0 },
};
const dashboardPaths: Record<Role, string> = { empresa: '/dashboard/company', profesional: '/dashboard/professional', admin: '/dashboard/admin' };

/** Todas las respuestas demo son locales. Se rechazan escrituras y lecturas ajenas al rol. */
export function demoResponse(endpoint: string, method: string, role: Role): unknown {
  if (method !== 'GET') throw new Error('Demo de solo lectura: esta acción requiere una cuenta real.');
  const path = endpoint.split('?')[0];
  if (path.startsWith('/dashboard/') && path !== dashboardPaths[role]) throw new Error('Esta vista no corresponde al rol demo.');
  if ((path.startsWith('/admin/') || path.startsWith('/analytics/') || path === '/subscriptions/revenue') && role !== 'admin') throw new Error('Esta vista requiere el rol administrador.');
  let data: unknown;
  switch (path) {
    case dashboardPaths[role]:
      data = { rol: role, kpis: kpis[role], metricas: {}, resumenTrabajos: { total: 4, publicado: 2, enProgreso: 1, completado: 1 }, estadisticas: {}, actividadReciente: activity } satisfies DashboardData;
      break;
    case '/jobs': data = role === 'profesional' ? jobs.filter(job => job.estado === 'publicado') : jobs; break;
    case '/companies': data = companies; break;
    case '/companies/me/profile': data = companies[0]; break;
    case '/professionals': data = professionals; break;
    case '/subscriptions/me': data = null; break;
    case '/subscriptions/plans': data = []; break;
    case '/subscriptions/history': data = { eventos: [] }; break;
    case '/subscriptions/revenue': data = []; break;
    case '/subscriptions/billing': data = { payments: [], pendingCheckout: null, entitlements: { period: new Date().toISOString().slice(0, 7), limits: { trabajosPublicados: 5, propuestasEnviadas: 5 }, used: { trabajosPublicados: 4, propuestasEnviadas: 3 } } }; break;
    case '/analytics/kpis': case '/admin/metrics': data = kpis.admin; break;
    case '/analytics/usage': data = { eventosPorTipo: { solicitudes: 4 }, eventosPorRol: { empresa: 1, profesional: 2, admin: 1 }, trabajosPorEstado: { publicado: 2, en_progreso: 1, completado: 1 }, suscripcionesPorPlan: {} }; break;
    case '/admin/users': data = DEMO_ACCOUNTS.map(account => ({ id: 'demo-' + account.role, nombre: 'Cuenta demo ' + account.role, email: account.email, rol: account.role, activo: true })); break;
    case '/auth/me': data = { usuario: { id: 'demo-' + role, nombre: 'Cuenta demo', email: role + '@demo.ofiai.local', rol: role, pais: 'AR' } }; break;
    case '/notifications': data = [{ id: 'demo-notification-1', titulo: 'Bienvenidos al demo del hackatón', mensaje: 'Los datos de esta cuenta son ficticios. El recorrido es de solo lectura.', leida: false }]; break;
    case '/coordinator/inbox': data = []; break;
    default: throw new Error('Esta función no forma parte del demo de solo lectura.');
  }
  return { exito: true, datos: data };
}
