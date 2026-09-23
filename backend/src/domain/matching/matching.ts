/**
 * @archivo matching.ts
 * @descripcion Proyecciones y huellas del modelo existente, sin duplicar entidades de negocio.
 */
import { createHash } from 'node:crypto';
import type { Trabajo } from '../../models/Job';
import type { Profesional } from '../../models/Professional';
import type { MatchingJob, MatchProfessional } from '../../../../shared/matching';
import { MATCHING_CATEGORY_ALIASES, MATCHING_POLICY, MATCHING_WEIGHTS } from '../../constants/matching';
/** Normaliza comparaciones sin alterar valores guardados. */
export function normalizeMatchText(value: unknown): string {
  return typeof value === 'string' ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ') : '';
}
/** Elimina contactos comunes y controles de texto enviado al modelo o mostrado al cliente. */
export function matchingText(value: unknown, max = 1500): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, ' ').replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[contacto omitido]').replace(/\+?\d[\d ()-]{8,}\d/g, '[numero omitido]').trim().slice(0, max) : '';
}
/** Conserva listas validas acotadas aunque falten campos historicos. */
export function matchingStrings(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((x): x is string => typeof x === 'string').map(x => matchingText(x, 180)).filter(Boolean))].slice(0, 30) : [];
}
/** Representa medidas desconocidas con null, nunca con un valor inventado. */
export function matchingNumber(value: unknown, max = 1e12): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : null;
}
/** Unifica codigos de pais del registro y nombres naturales del Intake. */
export function matchingCountry(value: unknown): string {
  const normalized = normalizeMatchText(value);
  const codes: Record<string, string> = { argentina: 'ar', mexico: 'mx', colombia: 'co', chile: 'cl', peru: 'pe', ecuador: 'ec', venezuela: 've', bolivia: 'bo', paraguay: 'py', uruguay: 'uy' };
  return codes[normalized] ?? normalized;
}
/** Reduce sinonimos conocidos y admite categorias nuevas sin migraciones. */
export function matchingCategory(value: string): string {
  const normalized = normalizeMatchText(value);
  return Object.entries(MATCHING_CATEGORY_ALIASES).find(([, aliases]) => aliases.includes(normalized))?.[0] ?? normalized;
}
/** Obtiene una fecha legible de Date/Timestamp sin adivinar fechas relativas. */
function matchingDate(value: unknown): string | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return matchingDate(value.toDate());
  return typeof value === 'string' ? matchingText(value, 200) || null : null;
}
/** Proyecta un Job real conservando ubicacion y presupuesto desconocidos. */
export function publicMatchingJob(job: Trabajo): MatchingJob {
  return { id: job.id, title: matchingText(job.titulo, 180), description: matchingText(job.descripcion, 4000), category: matchingText(job.categoria, 200),
    location: { country: job.location?.country ?? null, province: job.location?.region ?? null, city: job.ciudad ?? job.location?.city ?? null },
    urgency: job.urgency ?? null, preferredDate: job.preferredDate ?? matchingDate(job.fechaInicio),
    budget: { min: job.presupuestoMinimo ?? job.budget?.min ?? null, max: job.presupuestoMaximo ?? job.budget?.max ?? null, currency: job.budget?.currency ?? job.moneda ?? null },
    requirements: matchingStrings(job.habilidadesRequeridas ?? job.requirements), estimatedScope: matchingText(job.estimatedScope) || null,
    workType: job.tipoTrabajo, status: job.estado };
}
/** Los perfiles previos sin status conservan su estado activo, salvo baja explicita. */
export function isMatchingActive(pro: Profesional): boolean {
  return pro.activo !== false && (pro.status === undefined || pro.status === 'active');
}
/** No entrega UID, correo, telefono, direccion, coordenadas ni documentos. */
export function publicMatchProfessional(pro: Profesional): MatchProfessional {
  const image = typeof pro.fotoPerfil === 'string' && /^https:\/\//i.test(pro.fotoPerfil) ? pro.fotoPerfil : null;
  return { id: pro.id, firstName: matchingText(pro.nombre, 100), lastName: matchingText(pro.apellido, 100), profileImage: image,
    description: matchingText(pro.descripcionPerfil) || null, categories: matchingStrings(pro.categorias), skills: matchingStrings([...matchingStrings(pro.especialidades), ...matchingStrings(pro.habilidades)]),
    experienceYears: matchingNumber(pro.aniosExperiencia, 80),
    location: { country: pro.pais ?? null, province: pro.provincia ?? null, city: pro.ciudad ?? null },
    available: typeof pro.disponible === 'boolean' ? pro.disponible : null,
    availabilityDays: matchingStrings(Array.isArray(pro.disponibilidadHoraria) ? pro.disponibilidadHoraria.map(day => day?.dia) : []),
    minimumPrice: matchingNumber(pro.precioMinimo ?? pro.tarifaServicio), hourlyRate: matchingNumber(pro.tarifaHora),
    currency: pro.moneda ?? null, verified: pro.verificado === true,
    rating: pro.totalResenas > 0 ? matchingNumber(pro.calificacionPromedio, 5) : null,
    completedJobs: matchingNumber(pro.totalTrabajos), responseRate: matchingNumber(pro.tasaRespuesta, 1) };
}
/** Firma canonica de requisitos y version del algoritmo; ignora cambios operativos de matching. */
export function matchingJobFingerprint(job: Trabajo): string {
  return createHash('sha256').update(JSON.stringify({ job: publicMatchingJob(job), subcategory: job.subcategoria, coordinates: job.coordenadas ?? job.location,
    professionalTypes: job.professionalTypes, policy: MATCHING_POLICY.version, weights: MATCHING_WEIGHTS })).digest('hex');
}
/** Detecta perfiles cambiados antes de devolver o seleccionar una recomendacion cacheada. */
export function matchingProfileFingerprint(pro: Profesional): string {
  return createHash('sha256').update(JSON.stringify({ profile: publicMatchProfessional(pro), status: pro.status ?? 'active', active: pro.activo,
    coordinates: pro.coordenadas, radius: pro.radioServicioKm, hours: pro.disponibilidadHoraria, coverage: pro.zonaCobertura })).digest('hex');
}
