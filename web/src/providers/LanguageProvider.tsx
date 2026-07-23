/**
 * @archivo LanguageProvider.tsx
 * @descripcion Provider de idioma para OfiAI.
 * Gestiona el idioma activo y provee la función de traducción t().
 * @modulo Providers
 */
import { ReactNode, useState } from 'react';
import { LanguageContext, EstadoIdioma } from '../context/LanguageContext';
import { idiomaDefecto, type IdiomaOfiAI } from '../i18n';
import { esLA } from '../i18n/es-LA';
import { enUS } from '../i18n/en-US';

const diccionarios = { 'es-LA': esLA, 'es-MX': esLA, 'es-CO': esLA, 'es-CL': esLA, 'es-AR': esLA, 'es-PE': esLA, 'en-US': enUS };

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [idiomaActual, setIdiomaActual] = useState<IdiomaOfiAI>(idiomaDefecto);

  const t = (clave: string): string => {
    // Navega el objeto anidado usando la clave con notación de puntos
    // Ej: t('auth.iniciarSesion') → 'Iniciar sesión'
    const partes = clave.split('.');
    let resultado: unknown = diccionarios[idiomaActual];
    for (const parte of partes) {
      resultado = (resultado as Record<string, unknown>)?.[parte];
    }
    return (resultado as string) || clave; // Fallback a la clave si no existe traducción
  };

  const valorContexto: EstadoIdioma = {
    idiomaActual,
    cambiarIdioma: setIdiomaActual,
    t,
  };

  return (
    <LanguageContext.Provider value={valorContexto}>
      {children}
    </LanguageContext.Provider>
  );
};
