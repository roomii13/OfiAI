/**
 * @archivo matching.ts
 * @descripcion Pesos, limites y equivalencias del unico motor determinista de matching.
 */
export const MATCHING_WEIGHTS = { category: 30, skills: 20, location: 15, availability: 10, experience: 10, rating: 5, completedJobs: 5, responseRate: 5 } as const;
export const MATCHING_POLICY = {
  version: '1.0.0', semanticWeight: 0.2, maxSemanticCandidates: 20, candidatePageSize: 250,
  candidateLimit: 1000, leaseMs: 90000, recommendedThreshold: 70, nearDistanceKm: 30,
  fullExperienceYears: 8, fullCompletedJobs: 50,
} as const;
/** Equivalencias explicitas: nuevas categorias siguen siendo texto libre. */
export const MATCHING_CATEGORY_ALIASES: Record<string, string[]> = {
  electricidad: ['electricidad', 'electricista', 'electrica', 'electrico', 'instalaciones electricas'],
  plomeria: ['plomeria', 'plomero', 'plomera', 'fontaneria', 'fontanero', 'gasfiteria', 'instalaciones sanitarias'],
  gas: ['gas', 'gasista', 'instalaciones de gas'],
  albanileria: ['albanileria', 'albanil', 'construccion', 'obra civil'],
  pintura: ['pintura', 'pintor', 'pintora'],
  carpinteria: ['carpinteria', 'carpintero', 'carpintera'],
  programacion: ['programacion', 'programador', 'programadora', 'desarrollo web', 'desarrollo de software'],
  diseno: ['diseno', 'disenador', 'disenadora', 'diseno grafico'],
  fotografia: ['fotografia', 'fotografo', 'fotografa'],
  climatizacion: ['climatizacion', 'hvac', 'aire acondicionado', 'refrigeracion'],
  limpieza: ['limpieza', 'limpiador', 'limpiadora'],
  jardineria: ['jardineria', 'jardinero', 'jardinera', 'paisajismo'],
  impermeabilizacion: ['impermeabilizacion', 'impermeabilizador', 'humedad'],
  informatica: ['informatica', 'soporte tecnico', 'reparacion de computadoras'],
  cerrajeria: ['cerrajeria', 'cerrajero', 'cerrajera'],
};
/** Campos permitidos en lecturas de candidatos; excluye contactos, documentos y datos bancarios. */
export const MATCHING_PROFILE_FIELDS = [
  'id', 'nombre', 'apellido', 'fotoPerfil', 'descripcionPerfil', 'categorias', 'especialidades', 'habilidades',
  'aniosExperiencia', 'pais', 'provincia', 'ciudad', 'coordenadas', 'radioServicioKm',
  'disponible', 'disponibilidadHoraria', 'precioMinimo', 'tarifaServicio', 'tarifaHora', 'moneda',
  'verificado', 'calificacionPromedio', 'totalResenas', 'totalTrabajos', 'tasaRespuesta',
  'status', 'activo', 'fechaActualizacion', 'zonaCobertura',
] as const;
