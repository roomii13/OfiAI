/**
 * @archivo ThemeProvider.tsx
 * @descripcion Provider de tema claro/oscuro para OfiAI.
 * @modulo Providers
 */
import { ReactNode, useState, useEffect } from 'react';
import { ThemeContext, EstadoTema } from '../context/ThemeContext';

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [tema, setTema] = useState<'claro' | 'oscuro'>('claro');

  useEffect(() => {
    // TODO: Leer preferencia guardada en localStorage
    // TODO: Detectar preferencia del sistema operativo
    document.documentElement.setAttribute('data-theme', tema === 'oscuro' ? 'dark' : 'light');
  }, [tema]);

  const valorContexto: EstadoTema = {
    tema,
    toggleTema: () => setTema(t => t === 'claro' ? 'oscuro' : 'claro'),
    esOscuro: tema === 'oscuro',
  };

  return (
    <ThemeContext.Provider value={valorContexto}>
      {children}
    </ThemeContext.Provider>
  );
};
