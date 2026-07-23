/**
 * @archivo AuthContext.tsx
 * @descripcion
 * Contexto global de autenticación.
 *
 * Gestiona:
 * - Usuario actual
 * - Estado de sesión
 * - Roles:
 *    - company
 *    - professional
 *    - admin
 *
 * Preparado para Firebase Auth.
 */

import {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";


export type UserRole =
  | "company"
  | "professional"
  | "admin"
  | null;


export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}


interface AuthContextType {
  user: AuthUser | null;
  role: UserRole;
  loading: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
}


const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);


export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [user, setUser] =
    useState<AuthUser | null>(null);


  const [loading, setLoading] =
    useState(false);


  function login(newUser: AuthUser) {
    setLoading(true);

    setUser(newUser);

    setLoading(false);
  }


  function logout() {
    setUser(null);
  }


  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}



export function useAuth() {

  const context =
    useContext(AuthContext);


  if (!context) {
    throw new Error(
      "useAuth debe utilizarse dentro de AuthProvider"
    );
  }


  return context;
}