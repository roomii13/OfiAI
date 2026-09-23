/**
 * @archivo ranking.tool.ts
 * @descripcion Unico motor determinista, explicable y compatible con el contrato anterior.
 */
import type { Trabajo } from '../../models/Job';
import type { Profesional } from '../../models/Professional';
import { MATCHING_WEIGHTS as W, MATCHING_POLICY as P } from '../../constants/matching';
import { isMatchingActive, matchingCategory, matchingCountry, matchingStrings, normalizeMatchText, publicMatchProfessional, publicMatchingJob } from '../../domain/matching/matching';
import { calculateDistanceKm } from './distance.tool';

export type NivelCompatibilidad = 'alto' | 'medio' | 'bajo';
/** Componentes ponderados; su suma no supera 100. */
export interface ComponentesRanking { categoria: number; habilidades: number; ubicacion: number; disponibilidad: number; reputacion: number; experiencia: number; historial: number; respuesta: number }
/** Conserva los nombres originales para los consumidores del ranking previo. */
export interface ResultadoRankingProfesional {
  profesional: Profesional; puntaje: number; nivel: NivelCompatibilidad; razones: string[];
  alertas: string[]; componentes: ComponentesRanking; eligible: boolean; distanceKm: number | null;
}
/** Redondea puntajes sin producir NaN. */
function round(value: number): number { return Math.round(value * 100) / 100; }
/** Compara capacidades por sinonimo explicito o palabras completas, no por fragmentos ambiguos. */
function compatible(a: string, b: string): boolean {
  const x = matchingCategory(a); const y = matchingCategory(b);
  return Boolean(x && y && (x === y || (x.length >= 5 && y.split(' ').includes(x)) || (y.length >= 5 && x.split(' ').includes(y))));
}
/** Comprueba solo fechas absolutas; no adivina el dia de "proxima semana". */
function availableOnDate(date: string | null, days: string[]): boolean | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(date) || !days.length) return null;
  const parsed = new Date(date.slice(0, 10) + 'T12:00:00Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date.slice(0, 10)) return null;
  const weekday = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'][parsed.getUTCDay()];
  return days.some(day => normalizeMatchText(day) === weekday);
}
/** Evalua reglas propias; ninguna respuesta generativa puede remover un filtro duro. */
class RankingTool {
  /** Mantiene el ranking previo, incluyendo alertas para candidatos que obtienen cero. */
  rankearProfesionales(job: Trabajo, professionals: Profesional[], limit = 10): ResultadoRankingProfesional[] {
    return professionals.map(pro => this.evaluarProfesional(job, pro)).sort((a, b) => b.puntaje - a.puntaje || a.profesional.id.localeCompare(b.profesional.id)).slice(0, Math.max(1, limit));
  }
  /** Aplica categoria, estado, pais y radio antes de calcular compatibilidad. */
  evaluarProfesional(job: Trabajo, pro: Profesional): ResultadoRankingProfesional {
    const profile = publicMatchProfessional(pro); const summary = publicMatchingJob(job);
    const requiredCategories = [job.subcategoria || job.categoria, ...matchingStrings(job.professionalTypes)].filter(Boolean);
    const capacities = [...profile.categories, ...profile.skills];
    const categoryMatch = requiredCategories.some(category => capacities.some(capacity => compatible(category, capacity)));
    const location = job.coordenadas ? { latitude: job.coordenadas.latitud, longitude: job.coordenadas.longitud }
      : job.location?.latitude !== undefined && job.location.longitude !== undefined ? { latitude: job.location.latitude, longitude: job.location.longitude } : null;
    const coordinates = pro.coordenadas ? { latitude: pro.coordenadas.latitud, longitude: pro.coordenadas.longitud } : null;
    const distance = job.tipoTrabajo === 'remoto' ? null : calculateDistanceKm(location, coordinates);
    const radius = typeof pro.radioServicioKm === 'number' && Number.isFinite(pro.radioServicioKm) && pro.radioServicioKm >= 0 ? pro.radioServicioKm : null;
    const sameCity = Boolean(normalizeMatchText(summary.location.city) && normalizeMatchText(summary.location.city) === normalizeMatchText(profile.location.city));
    const coverage = matchingStrings(pro.zonaCobertura).some(city => normalizeMatchText(city) === normalizeMatchText(summary.location.city));
    const countryMismatch = summary.location.country && profile.location.country && matchingCountry(summary.location.country) !== matchingCountry(profile.location.country);
    const urgent = summary.urgency === 'high' || summary.urgency === 'emergency';
    const reasons: string[] = []; const concerns: string[] = [];
    let eligible = isMatchingActive(pro) && categoryMatch;
    if (!isMatchingActive(pro)) concerns.push('El perfil no esta activo.');
    if (!categoryMatch) concerns.push('La categoria y capacidades no coinciden con el servicio.');
    if (job.tipoTrabajo !== 'remoto' && countryMismatch) { eligible = false; concerns.push('El profesional se encuentra en otro pais.'); }
    if (distance !== null && radius !== null && distance > radius) { eligible = false; concerns.push('El trabajo esta fuera del radio de servicio declarado.'); }
    if (urgent && profile.available === false) { eligible = false; concerns.push('No esta disponible para una solicitud urgente.'); }
    const skills = summary.requirements;
    const matchedSkills = skills.filter(skill => capacities.some(capacity => compatible(skill, capacity)));
    const dateAvailable = availableOnDate(summary.preferredDate, profile.availabilityDays);
    const proximity = distance === null ? null : radius === 0 ? Number(distance === 0) : Math.max(0, 1 - distance / (radius ?? P.nearDistanceKm * 2));
    const locationScore = job.tipoTrabajo === 'remoto' ? 1 : proximity ?? (sameCity || coverage ? 1 : 0);
    const components: ComponentesRanking = {
      categoria: categoryMatch ? W.category : 0,
      habilidades: (skills.length ? matchedSkills.length / skills.length : categoryMatch ? 1 : 0) * W.skills,
      ubicacion: locationScore * W.location,
      disponibilidad: profile.available === true && dateAvailable !== false ? W.availability : 0,
      experiencia: Math.min(profile.experienceYears ?? 0, P.fullExperienceYears) / P.fullExperienceYears * W.experience,
      reputacion: (profile.rating ?? 0) / 5 * W.rating,
      historial: Math.min(profile.completedJobs ?? 0, P.fullCompletedJobs) / P.fullCompletedJobs * W.completedJobs,
      respuesta: (profile.responseRate ?? 0) * W.responseRate,
    };
    if (categoryMatch) reasons.push('Coincide con la categoria o una especialidad requerida.');
    if (matchedSkills.length) reasons.push('Habilidades coincidentes: ' + matchedSkills.join(', ') + '.');
    if (job.tipoTrabajo === 'remoto') reasons.push('La solicitud admite trabajo remoto.');
    else if (sameCity) reasons.push('Se encuentra en la misma ciudad.');
    else if (distance !== null) reasons.push('Distancia aproximada: ' + round(distance) + ' km en linea recta.');
    else if (coverage) reasons.push('Declara cobertura en la ciudad solicitada.');
    if (profile.experienceYears !== null && profile.experienceYears > 0) reasons.push(profile.experienceYears + ' anios de experiencia declarados.');
    if (profile.rating !== null && profile.rating >= 4) reasons.push('Buena valoracion con resenas registradas.');
    if (profile.verified) reasons.push('Perfil verificado por OfiAI.');
    if (skills.length > matchedSkills.length) concerns.push('Confirmar requisitos no acreditados en el perfil: ' + skills.filter(skill => !matchedSkills.includes(skill)).join(', ') + '.');
    if (profile.available === null) concerns.push('Disponibilidad por confirmar.');
    if (profile.available === false || dateAvailable === false) concerns.push('La disponibilidad declarada no coincide; requiere confirmacion.');
    if (dateAvailable === null && summary.preferredDate) concerns.push('Fecha y horario exactos por confirmar.');
    if (job.tipoTrabajo !== 'remoto' && distance === null) concerns.push('No hay coordenadas suficientes para calcular distancia.');
    if (job.tipoTrabajo !== 'remoto' && !sameCity && !coverage && distance === null) concerns.push('Cobertura fuera de la ciudad por confirmar.');
    if (!profile.verified) concerns.push('Perfil sin verificacion.');
    if (profile.rating === null) concerns.push('Sin valoraciones comprobables.');
    if (summary.budget.max !== null && profile.minimumPrice !== null && summary.budget.currency === profile.currency && profile.minimumPrice > summary.budget.max) concerns.push('El precio minimo declarado supera el presupuesto. No es una cotizacion.');
    const score = eligible ? Math.min(100, Object.values(components).reduce((sum, value) => sum + value, 0)) : 0;
    return { profesional: pro, puntaje: round(score), nivel: score >= P.recommendedThreshold ? 'alto' : score >= 50 ? 'medio' : 'bajo',
      eligible, distanceKm: distance === null ? null : round(distance), razones: reasons, alertas: concerns,
      componentes: Object.fromEntries(Object.entries(components).map(([key, value]) => [key, round(value)])) as unknown as ComponentesRanking };
  }
}
export const rankingTool = new RankingTool();
