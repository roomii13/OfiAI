/**
 * @archivo i18n/index.ts
 * @descripcion Sistema de internacionalización para OfiAI.
 * Soporta Español Latino como idioma principal con adaptaciones por país.
 * @modulo i18n
 */

export type IdiomaOfiAI = 'es-LA' | 'es-MX' | 'es-CO' | 'es-CL' | 'es-AR' | 'es-PE' | 'en-US';

export interface ConfiguracionIdioma {
  codigo: IdiomaOfiAI;
  nombre: string;
  bandera: string;
  pais: string;
}

export const IDIOMAS_SOPORTADOS: ConfiguracionIdioma[] = [
  { codigo: 'es-LA', nombre: 'Español (LATAM)', bandera: '🌎', pais: 'LATAM' },
  { codigo: 'es-MX', nombre: 'Español (México)', bandera: '🇲🇽', pais: 'MX' },
  { codigo: 'es-CO', nombre: 'Español (Colombia)', bandera: '🇨🇴', pais: 'CO' },
  { codigo: 'es-CL', nombre: 'Español (Chile)', bandera: '🇨🇱', pais: 'CL' },
  { codigo: 'es-AR', nombre: 'Español (Argentina)', bandera: '🇦🇷', pais: 'AR' },
  { codigo: 'es-PE', nombre: 'Español (Perú)', bandera: '🇵🇪', pais: 'PE' },
  { codigo: 'en-US', nombre: 'English (US)', bandera: '🇺🇸', pais: 'US' },
];

// TODO: Implementar función de traducción t(clave, variables?)
// TODO: Implementar detectar idioma del navegador/país del usuario
// TODO: Importar diccionarios de traducción
export const idiomaDefecto: IdiomaOfiAI = 'es-LA';
