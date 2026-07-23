/**
 * @archivo mobile/src/context/AuthContext.tsx
 * @descripcion Contexto de autenticación para la app móvil de OfiAI.
 * Sincronizado con Firebase Auth y el backend.
 * @modulo Mobile Context
 */
import { createContext, useContext, ReactNode } from 'react';
import type { UsuarioMobile } from '../types';

interface EstadoAuthMobile {
  usuario: UsuarioMobile | null;
  cargando: boolean;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
}

const AuthContext = createContext<EstadoAuthMobile | undefined>(undefined);

export const useAuthMobile = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthMobile debe usarse dentro de AuthProvider');
  return ctx;
};

export const AuthProviderMobile = ({ children }: { children: ReactNode }) => {
  // TODO: Implementar con Firebase Auth para React Native
  // TODO: Persistir sesión con expo-secure-store
  const valor: EstadoAuthMobile = {
    usuario: null,
    cargando: false,
    iniciarSesion: async () => {},
    cerrarSesion: async () => {},
  };

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
};
