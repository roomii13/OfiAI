/**
 * @archivo matching-fixtures.ts
 * @descripcion Catalogo sintetico exclusivo de tests; nunca se publica en Firestore productivo.
 */
import type { Profesional } from '../src/models/Professional';
import type { Trabajo } from '../src/models/Job';
/** Job completo con ubicacion y requisitos conocidos. */
export function matchingJob(overrides: Partial<Trabajo> = {}): Trabajo {
  return { id: 'job-matching', empresaId: 'company-company-a', titulo: 'Reparacion electrica de edificio',
    descripcion: 'Reparar el tablero y revisar las instalaciones electricas del edificio.', categoria: 'Electricidad',
    habilidadesRequeridas: ['tablero'], tipoTrabajo: 'presencial', ciudad: 'Santa Rosa',
    location: { country: 'Argentina', city: 'Santa Rosa', region: 'La Pampa' },
    coordenadas: { latitud: -36.62, longitud: -64.29 }, urgency: 'normal',
    moneda: 'ARS', estado: 'publicado', propuestasRecibidas: 0, source: 'ai_intake',
    fechaCreacion: new Date('2026-09-23T00:00:00Z'), fechaActualizacion: new Date('2026-09-23T00:00:00Z'), ...overrides };
}
/** Profesional configurable con evidencia suficiente para alcanzar 100 puntos. */
export function matchingProfessional(overrides: Partial<Profesional> = {}): Profesional {
  return { id: 'pro-electrician', usuarioId: 'private-user-id', nombre: 'Perfil', apellido: 'De prueba',
    categorias: ['Electricista'], especialidades: ['tablero'], aniosExperiencia: 8, moneda: 'ARS',
    disponible: true, status: 'active', pais: 'AR', ciudad: 'Santa Rosa',
    coordenadas: { latitud: -36.62, longitud: -64.29 }, radioServicioKm: 40,
    totalResenas: 20, calificacionPromedio: 5, totalTrabajos: 50, tasaRespuesta: 1, verificado: true,
    descripcionPerfil: 'Reparacion de instalaciones y tableros.', precioMinimo: 40000,
    fechaCreacion: new Date('2026-09-23T00:00:00Z'), fechaActualizacion: new Date('2026-09-23T00:00:00Z'), ...overrides };
}
/** Doce rubros y perfiles deliberadamente incompatibles para probar discriminacion. */
export function matchingCatalog(): Profesional[] {
  return ['Electricista', 'Plomero', 'Gasista', 'Albanil', 'Pintor', 'Carpintero', 'Programador',
    'Disenador', 'Fotografo', 'Tecnico HVAC', 'Limpieza', 'Jardinero'].map((trade, index) => matchingProfessional({
      id: 'fixture-' + index, nombre: 'Prueba ' + trade, categorias: [trade],
      especialidades: index === 0 ? ['tablero'] : [trade], aniosExperiencia: index % 9, ciudad: index % 2 ? 'Toay' : 'Santa Rosa',
    }));
}
