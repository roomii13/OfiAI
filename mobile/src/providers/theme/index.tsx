/**
 * @archivo mobile/src/providers/theme/index.tsx
 * @descripcion Provider de tema para la app móvil de OfiAI.
 * @modulo Mobile Providers
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';
import { COLORES_MARCA } from '../../constants';

export interface TemaMobile {
  modo: 'claro' | 'oscuro';
  colores: {
    fondo: string;
    superficie: string;
    texto: string;
    textoSuave: string;
    borde: string;
    primario: string;
    exito: string;
    advertencia: string;
    error: string;
  };
  alternarTema: () => void;
}

const ThemeContextMobile = createContext<TemaMobile | undefined>(undefined);

/**
 * Obtiene el modo inicial según la preferencia del sistema operativo.
 */
function getInitialTheme(): 'claro' | 'oscuro' {
  return Appearance.getColorScheme() === 'dark' ? 'oscuro' : 'claro';
}

/**
 * Hook para consumir el tema móvil.
 */
export function useThemeMobile(): TemaMobile {
  const context = useContext(ThemeContextMobile);

  if (!context) {
    throw new Error('useThemeMobile debe usarse dentro de ThemeProviderMobile');
  }

  return context;
}

/**
 * Provider de tema claro/oscuro para React Native.
 */
export const ThemeProviderMobile = ({ children }: { children: ReactNode }) => {
  const [modo, setModo] = useState<'claro' | 'oscuro'>(getInitialTheme);

  const value = useMemo<TemaMobile>(() => ({
    modo,
    colores: {
      fondo: modo === 'oscuro' ? '#0f172a' : COLORES_MARCA.fondo,
      superficie: modo === 'oscuro' ? '#111827' : '#ffffff',
      texto: modo === 'oscuro' ? '#f8fafc' : COLORES_MARCA.texto,
      textoSuave: modo === 'oscuro' ? '#cbd5e1' : '#64748b',
      borde: modo === 'oscuro' ? '#334155' : '#e5e7eb',
      primario: COLORES_MARCA.primario,
      exito: COLORES_MARCA.exito,
      advertencia: COLORES_MARCA.advertencia,
      error: COLORES_MARCA.error,
    },
    alternarTema: () => setModo(previous => previous === 'claro' ? 'oscuro' : 'claro'),
  }), [modo]);

  return (
    <ThemeContextMobile.Provider value={value}>
      {children}
    </ThemeContextMobile.Provider>
  );
};
