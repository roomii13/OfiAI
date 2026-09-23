/**
 * @archivo jobCategories.ts
 * @descripcion Categorías y subcategorías de oficios disponibles en OfiAI.
 * Diseñado para el mercado latinoamericano de profesionales de oficios.
 */
export const CATEGORIAS_OFICIOS = [
  { id: 'construccion', nombre: 'Construcción', subcategorias: ['albanileria', 'carpinteria', 'pintura', 'yeseria', 'impermeabilizacion'] },
  { id: 'instalaciones', nombre: 'Instalaciones', subcategorias: ['plomeria', 'electricidad', 'gas', 'aire_acondicionado', 'calefaccion'] },
  { id: 'mantenimiento', nombre: 'Mantenimiento', subcategorias: ['limpieza', 'jardineria', 'fumigacion', 'reparaciones_generales'] },
  { id: 'tecnologia', nombre: 'Tecnología', subcategorias: ['redes', 'camaras', 'computacion', 'automatizacion'] },
  { id: 'acabados', nombre: 'Acabados', subcategorias: ['ceramica', 'pisos', 'ventanas', 'puertas', 'closets'] },
  { id: 'automotriz', nombre: 'Automotriz', subcategorias: ['mecanica', 'pintura_auto', 'electricidad_auto', 'carroceria'] },
  { id: 'salud', nombre: 'Salud y Cuidado', subcategorias: ['enfermeria', 'cuidado_adultos', 'fisioterapia'] },
  { id: 'logistica', nombre: 'Logística', subcategorias: ['mudanzas', 'flete', 'mensajeria'] },
] as const;

export const CATEGORIAS_OFICIOS_POR_PAIS = {
  AR: CATEGORIAS_OFICIOS,
  MX: CATEGORIAS_OFICIOS,
  CO: CATEGORIAS_OFICIOS,
  CL: CATEGORIAS_OFICIOS,
  PE: CATEGORIAS_OFICIOS,
} as const;
