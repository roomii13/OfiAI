/**
 * @archivo ai-tools.test.ts
 * @descripcion Pruebas unitarias para herramientas determinísticas de IA.
 */
import { classificationTool } from '../../src/ai/tools/classification.tool';
import { rankingTool } from '../../src/ai/tools/ranking.tool';
import type { Trabajo } from '../../src/models/Job';
import type { Profesional } from '../../src/models/Professional';

/**
 * Crea un trabajo base para pruebas de ranking.
 */
function crearTrabajo(overrides: Partial<Trabajo> = {}): Trabajo {
  const fecha = new Date('2026-08-22T12:00:00.000Z');

  return {
    id: 'job-test',
    empresaId: 'empresa-test',
    titulo: 'Instalación eléctrica urgente',
    descripcion: 'Se requiere instalación eléctrica presencial con revisión de tablero.',
    categoria: 'instalaciones',
    subcategoria: 'electricidad',
    habilidadesRequeridas: ['electricidad', 'tablero'],
    presupuestoMinimo: 100000,
    presupuestoMaximo: 250000,
    moneda: 'ARS',
    tipoTrabajo: 'presencial',
    ciudad: 'Buenos Aires',
    estado: 'publicado',
    propuestasRecibidas: 0,
    fechaCreacion: fecha,
    fechaActualizacion: fecha,
    ...overrides,
  };
}

/**
 * Crea un profesional base para pruebas de ranking.
 */
function crearProfesional(overrides: Partial<Profesional> = {}): Profesional {
  const fecha = new Date('2026-08-22T12:00:00.000Z');

  return {
    id: 'pro-test',
    usuarioId: 'usuario-test',
    nombre: 'Camila',
    apellido: 'Rios',
    especialidades: ['electricidad', 'tablero'],
    categorias: ['instalaciones'],
    aniosExperiencia: 8,
    moneda: 'ARS',
    disponible: true,
    pais: 'AR',
    ciudad: 'Buenos Aires',
    calificacionPromedio: 4.9,
    totalResenas: 18,
    totalTrabajos: 22,
    verificado: true,
    fechaCreacion: fecha,
    fechaActualizacion: fecha,
    ...overrides,
  };
}

describe('classificationTool', () => {
  it('clasifica solicitudes urgentes de electricidad como instalaciones con prioridad alta o urgente', () => {
    const resultado = classificationTool.clasificarSolicitud({
      titulo: 'Emergencia eléctrica',
      descripcion: 'Necesito electricidad urgente hoy por falla de tablero trifasico con visita presencial.',
      ciudad: 'Buenos Aires',
    });

    expect(resultado.categoria).toBe('instalaciones');
    expect(['alta', 'urgente']).toContain(resultado.prioridad);
    expect(resultado.habilidadesDetectadas.length).toBeGreaterThan(0);
    expect(resultado.requiereVisitaTecnica).toBe(true);
  });
});

describe('rankingTool', () => {
  it('prioriza profesionales verificados, disponibles y compatibles con ciudad y habilidades', () => {
    const trabajo = crearTrabajo();
    const ranking = rankingTool.rankearProfesionales(trabajo, [
      crearProfesional({ id: 'pro-alto' }),
      crearProfesional({
        id: 'pro-bajo',
        categorias: ['logistica'],
        especialidades: ['flete'],
        disponible: false,
        ciudad: 'Rosario',
        calificacionPromedio: 3.5,
        verificado: false,
      }),
    ]);

    expect(ranking[0]?.profesional.id).toBe('pro-alto');
    expect(ranking[0]?.nivel).toBe('alto');
    expect(ranking[0]?.puntaje).toBeGreaterThan(ranking[1]?.puntaje ?? 0);
    expect(ranking[1]?.alertas.length).toBeGreaterThan(0);
  });
});
