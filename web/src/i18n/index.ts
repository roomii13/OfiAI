/**
 * @archivo i18n/index.ts
 * @descripcion Sistema de internacionalización para OfiAI.
 * Soporta Español Latino como idioma principal con adaptaciones por país.
 * @modulo i18n
 */
import { enUS } from './en-US';
import { esLA } from './es-LA';

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

export const idiomaDefecto: IdiomaOfiAI = 'es-LA';

type DiccionarioTraducciones = Record<string, unknown>;

const diccionarios: Record<IdiomaOfiAI, DiccionarioTraducciones> = {
  'es-LA': esLA,
  'es-MX': esLA,
  'es-CO': esLA,
  'es-CL': esLA,
  'es-AR': esLA,
  'es-PE': esLA,
  'en-US': enUS,
};

/**
 * Traduce una clave con notación de puntos usando el idioma seleccionado.
 */
export function traducir(clave: string, idioma: IdiomaOfiAI = idiomaDefecto): string {
  const partes = clave.split('.');
  let resultado: unknown = diccionarios[idioma];

  for (const parte of partes) {
    resultado = (resultado as Record<string, unknown>)?.[parte];
  }

  return typeof resultado === 'string' ? resultado : clave;
}

/**
 * Detecta el idioma más cercano soportado por OfiAI desde el navegador.
 */
export function detectarIdiomaNavegador(locale: string = navigator.language): IdiomaOfiAI {
  const normalizado = locale.toLowerCase();

  if (normalizado.startsWith('en')) {
    return 'en-US';
  }

  if (normalizado.includes('mx')) {
    return 'es-MX';
  }

  if (normalizado.includes('co')) {
    return 'es-CO';
  }

  if (normalizado.includes('cl')) {
    return 'es-CL';
  }

  if (normalizado.includes('ar')) {
    return 'es-AR';
  }

  if (normalizado.includes('pe')) {
    return 'es-PE';
  }

  return idiomaDefecto;
}
