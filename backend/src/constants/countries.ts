/**
 * @archivo countries.ts
 * @descripcion Países soportados por OfiAI con su configuración regional.
 * OfiAI está diseñado para el mercado latinoamericano de habla hispana.
 */
export const PAISES_SOPORTADOS = [
  { codigo: 'MX', nombre: 'México', moneda: 'MXN', idioma: 'es-MX', telefono: '+52' },
  { codigo: 'CO', nombre: 'Colombia', moneda: 'COP', idioma: 'es-CO', telefono: '+57' },
  { codigo: 'CL', nombre: 'Chile', moneda: 'CLP', idioma: 'es-CL', telefono: '+56' },
  { codigo: 'AR', nombre: 'Argentina', moneda: 'ARS', idioma: 'es-AR', telefono: '+54' },
  { codigo: 'PE', nombre: 'Perú', moneda: 'PEN', idioma: 'es-PE', telefono: '+51' },
  { codigo: 'EC', nombre: 'Ecuador', moneda: 'USD', idioma: 'es-EC', telefono: '+593' },
  { codigo: 'VE', nombre: 'Venezuela', moneda: 'VES', idioma: 'es-VE', telefono: '+58' },
  { codigo: 'BO', nombre: 'Bolivia', moneda: 'BOB', idioma: 'es-BO', telefono: '+591' },
  { codigo: 'PY', nombre: 'Paraguay', moneda: 'PYG', idioma: 'es-PY', telefono: '+595' },
  { codigo: 'UY', nombre: 'Uruguay', moneda: 'UYU', idioma: 'es-UY', telefono: '+598' },
] as const;

export type CodigoPaisOfiAI = typeof PAISES_SOPORTADOS[number]['codigo'];
