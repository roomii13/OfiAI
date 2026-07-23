/**
 * @archivo AuthProvider.tsx
 * @descripcion Provider de autenticación Firebase para OfiAI.
 * Envuelve la aplicación y provee el estado de auth a todos los componentes.
 * @modulo Providers
 */
import { ReactNode } from 'react';
import { AuthContext, EstadoAuth } from '../context/AuthContext';

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Provider de autenticación.
 * TODO: Implementar listener de onAuthStateChanged de Firebase
 * TODO: Verificar token y obtener perfil del usuario desde Firestore
 * TODO: Manejar persistencia de sesión
 * TODO: Implementar todos los métodos de EstadoAuth
 */
export const AuthProvider = ({ children }: AuthProviderProps) => {
  // TODO: Estado real de autenticación con Firebase
  const valorContexto: EstadoAuth = {
    usuario: null,
    cargando: false,
    estaAutenticado: false,
    iniciarSesion: async () => { /* TODO */ },
    registrarse: async () => { /* TODO */ },
    cerrarSesion: async () => { /* TODO */ },
    recuperarPassword: async () => { /* TODO */ },
  };

  return (
    <AuthContext.Provider value={valorContexto}>
      {children}
    </AuthContext.Provider>
  );
};
