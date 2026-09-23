/**
 * @archivo matching.test.ts
 * @descripcion Reglas, distancias, optionalidad y privacidad del Matching Agent.
 */
import { calculateDistanceKm } from '../../src/ai/tools/distance.tool';
import { rankingTool } from '../../src/ai/tools/ranking.tool';
import { MATCHING_WEIGHTS } from '../../src/constants/matching';
import { publicMatchProfessional, publicMatchingJob, matchingProfileFingerprint } from '../../src/domain/matching/matching';
import { matchingPrompt } from '../../src/ai/prompts/matching.prompt';
import { matchingJob, matchingProfessional, matchingCatalog } from '../matching-fixtures';
import type { Profesional } from '../../src/models/Professional';

it('calcula Haversine y rechaza coordenadas incompletas o fuera de rango', () => {
  expect(calculateDistanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo(111.195, 2);
  expect(calculateDistanceKm(null, { latitude: 0, longitude: 0 })).toBeNull();
  expect(calculateDistanceKm({ latitude: 91, longitude: 0 }, { latitude: 0, longitude: 0 })).toBeNull();
  expect(calculateDistanceKm({ latitude: NaN, longitude: 0 }, { latitude: 0, longitude: 0 })).toBeNull();
});
it('centraliza pesos que suman 100 y produce un puntaje explicable', () => {
  expect(Object.values(MATCHING_WEIGHTS).reduce((sum, value) => sum + value, 0)).toBe(100);
  const row = rankingTool.evaluarProfesional(matchingJob(), matchingProfessional());
  expect(row).toMatchObject({ puntaje: 100, eligible: true, distanceKm: 0, nivel: 'alto' });
  expect(row.razones.length).toBeGreaterThan(2);
});
it('radio cero y ciudad desconocida nunca generan NaN', () => {
  const row = rankingTool.evaluarProfesional(matchingJob(), matchingProfessional({ radioServicioKm: 0, ciudad: '' }));
  expect(row.eligible).toBe(true); expect(Number.isFinite(row.puntaje)).toBe(true);
});
it('discrimina doce oficios sin hardcodear resultados y excluye al fotografo', () => {
  const rows = rankingTool.rankearProfesionales(matchingJob(), matchingCatalog(), 12);
  expect(rows.filter(row => row.eligible).map(row => row.profesional.id)).toEqual(['fixture-0']);
  expect(rows.find(row => row.profesional.categorias[0] === 'Fotografo')?.puntaje).toBe(0);
});
it.each(['inactive', 'suspended'] as const)('excluye estado %s aunque tenga experiencia', status => {
  expect(rankingTool.evaluarProfesional(matchingJob(), matchingProfessional({ status })).eligible).toBe(false);
});
it('conserva perfiles legados sin status, pero respeta baja explicita', () => {
  expect(rankingTool.evaluarProfesional(matchingJob(), matchingProfessional({ status: undefined })).eligible).toBe(true);
  expect(rankingTool.evaluarProfesional(matchingJob(), matchingProfessional({ activo: false })).eligible).toBe(false);
});
it('reconoce sinonimos, acentos y categorias extensibles', () => {
  expect(rankingTool.evaluarProfesional(matchingJob({ categoria: 'Plomeria' }), matchingProfessional({ categorias: ['Plomero'] })).eligible).toBe(true);
  expect(rankingTool.evaluarProfesional(matchingJob({ categoria: 'Tecnologia especial XYZ' }), matchingProfessional({ categorias: ['Tecnologia especial XYZ'] })).eligible).toBe(true);
});
it('excluye distancia fuera de radio y prioriza cerca si no hay radio declarado', () => {
  const far = matchingProfessional({ id: 'far', ciudad: 'Otra ciudad', coordenadas: { latitud: -37.35, longitud: -64.29 }, aniosExperiencia: 2 });
  expect(rankingTool.evaluarProfesional(matchingJob(), far).eligible).toBe(false);
  const rows = rankingTool.rankearProfesionales(matchingJob(), [{ ...far, radioServicioKm: undefined }, matchingProfessional()]);
  expect(rows[0].profesional.id).toBe('pro-electrician');
  expect(rows[1].puntaje).toBeLessThan(rows[0].puntaje);
});
it('aplica pais solo presencial y no impone radio a trabajos remotos', () => {
  const pro = matchingProfessional({ pais: 'CL', coordenadas: { latitud: 0, longitud: 0 }, radioServicioKm: 1 });
  expect(rankingTool.evaluarProfesional(matchingJob(), pro).eligible).toBe(false);
  expect(rankingTool.evaluarProfesional(matchingJob({ tipoTrabajo: 'remoto' }), pro).eligible).toBe(true);
});
it('usa disponibilidad, fecha absoluta y urgencia sin adivinar fechas relativas', () => {
  const unavailable = matchingProfessional({ disponible: false });
  expect(rankingTool.evaluarProfesional(matchingJob({ urgency: 'emergency' }), unavailable).eligible).toBe(false);
  const pro = matchingProfessional({ disponibilidadHoraria: [{ dia: 'lunes', desde: '08:00', hasta: '17:00' }] });
  const row = rankingTool.evaluarProfesional(matchingJob({ preferredDate: '2026-09-23' }), pro);
  expect(row.componentes.disponibilidad).toBe(0);
  expect(row.alertas.join(' ')).toContain('disponibilidad');
  expect(rankingTool.evaluarProfesional(matchingJob({ preferredDate: 'La proxima semana' }), pro).alertas.join(' ')).toContain('Fecha');
});
it('maneja opcionales sin inventar reputacion, precio, experiencia o distancia', () => {
  const pro = { id: 'legacy', nombre: 'Legacy', categorias: ['electricidad'] } as Profesional;
  const profile = publicMatchProfessional(pro);
  expect(profile).toMatchObject({ rating: null, experienceYears: null, available: null, minimumPrice: null });
  const row = rankingTool.evaluarProfesional(matchingJob(), pro);
  expect(Number.isFinite(row.puntaje)).toBe(true); expect(row.distanceKm).toBeNull();
  expect(publicMatchProfessional(matchingProfessional({ totalResenas: 0, calificacionPromedio: 5 })).rating).toBeNull();
});
it('el prompt no envia contactos, nombres, UID, documentos ni ubicacion exacta', () => {
  const pro = matchingProfessional({ nombre: 'NombrePrivado', descripcionPerfil: 'Tableros. Contacto privado@example.test +5492954123456' });
  const prompt = matchingPrompt(publicMatchingJob(matchingJob()), rankingTool.rankearProfesionales(matchingJob(), [pro]));
  for (const privateValue of ['private-user-id', 'NombrePrivado', 'privado@example.test', '5492954123456', 'coordenadas', '-36.62']) expect(prompt).not.toContain(privateValue);
  expect(prompt).toContain('professionalId');
});
it('invalida cache al cambiar cobertura sin depender de fechaActualizacion', () => {
  const pro = matchingProfessional();
  expect(matchingProfileFingerprint(pro)).not.toBe(matchingProfileFingerprint({ ...pro, zonaCobertura: ['Toay'] }));
});
