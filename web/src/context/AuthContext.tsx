/**
 * @archivo AuthContext.tsx
 * @descripcion
 * Contexto global de autenticación para la aplicación web de OfiAI.
 * Coordina el login REST del backend, el intercambio de custom token con Firebase
 * cuando existe configuración cliente y la persistencia local de sesión.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getIdToken, onIdTokenChanged, signInWithCustomToken, signOut } from "firebase/auth";
import { api, setAuthToken } from "../lib/api/client";
import { configuracion } from "../lib/config";
import { auth } from "../lib/firebase";
import { authenticateDemo } from "../lib/api/demo";

/**
 * Roles soportados por OfiAI en backend, web y mobile.
 */
export type UserRole =
  | "empresa"
  | "profesional"
  | "admin";

/**
 * Usuario autenticado normalizado para las vistas web.
 */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  accountType?: UserRole | 'particular';
  country?: string;
  phone?: string;
  plan?: "gratuito" | "profesional" | "empresa";
}

/**
 * Credenciales de inicio de sesión aceptadas por el backend.
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Datos del formulario de registro de empresa.
 */
export interface RegisterCompanyInput extends LoginCredentials {
  nombre: string;
  apellido?: string;
  pais: "MX" | "CO" | "CL" | "AR" | "PE" | "EC" | "VE" | "BO" | "PY" | "UY";
  nombreEmpresa: string;
  industria: string;
  tamanoEmpresa: "micro" | "pequena" | "mediana" | "grande";
  ciudad: string;
  rut?: string;
  telefono?: string;
}

/**
 * Datos del formulario de registro profesional.
 */
export interface RegisterProfessionalInput extends LoginCredentials {
  nombre: string;
  apellido: string;
  pais: "MX" | "CO" | "CL" | "AR" | "PE" | "EC" | "VE" | "BO" | "PY" | "UY";
  especialidades: string[];
  categorias: string[];
  aniosExperiencia: number;
  ciudad: string;
  tarifaHora?: number;
  telefono?: string;
}

/** Registro de una persona sin identidad societaria. */
export type RegisterCitizenInput = Pick<RegisterProfessionalInput, 'email' | 'password' | 'nombre' | 'apellido' | 'pais' | 'ciudad' | 'telefono'>;

/**
 * Estado y acciones expuestas a toda la aplicación autenticada.
 */
export interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  loading: boolean;
  token: string | null;
  isAuthenticated: boolean;
  demoAccessEnabled: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  loginAsDemo: (role: UserRole) => void;
  registerCompany: (input: RegisterCompanyInput) => Promise<void>;
  registerCitizen: (input: RegisterCitizenInput) => Promise<void>;
  registerProfessional: (input: RegisterProfessionalInput) => Promise<void>;
  recoverPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

interface BackendUser {
  id: string;
  email: string;
  nombre: string;
  apellido?: string;
  telefono?: string;
  rol: UserRole;
  tipoCuenta?: UserRole | 'particular';
  pais?: string;
}

interface BackendAuthPayload {
  usuario: BackendUser;
  customToken?: string;
}

interface ApiEnvelope<T> {
  exito: boolean;
  mensaje?: string;
  datos?: T;
}

interface StoredSession {
  user: AuthUser;
  token: string | null;
}

const AUTH_STORAGE_KEY = "ofiai.web.auth";

/**
 * Convierte el usuario de Firestore a un contrato simple para UI.
 */
function normalizeUser(user: BackendUser): AuthUser {
  const displayName = [user.nombre, user.apellido].filter(Boolean).join(" ");

  return {
    id: user.id,
    name: displayName || user.email,
    email: user.email,
    role: user.rol,
    accountType: user.tipoCuenta ?? user.rol,
    country: user.pais,
    phone: user.telefono,
  };
}

/**
 * Extrae datos de una respuesta API estandarizada o lanza un error legible.
 */
function readApiData<T>(response: ApiEnvelope<T>): T {
  if (!response.exito || !response.datos) {
    throw new Error(response.mensaje ?? "La API no devolvió datos válidos.");
  }

  return response.datos;
}

/**
 * Lee la sesión almacenada en el navegador sin romper el render inicial.
 */
function readStoredSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

/**
 * Persiste la sesión activa y sincroniza el token del cliente HTTP.
 */
function persistSession(session: StoredSession): void {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  setAuthToken(session.token);
}

/**
 * Elimina la sesión persistida y limpia el token del cliente HTTP.
 */
function clearStoredSession(): void {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  setAuthToken(null);
}

/**
 * Intercambia un custom token de Firebase por un ID token utilizable por la API.
 */
async function resolveSessionToken(customToken?: string): Promise<string | null> {
  if (!customToken) {
    return null;
  }

  if (!auth) {
    throw new Error("Firebase cliente web no está configurado para completar la sesión.");
  }

  const credential = await signInWithCustomToken(auth, customToken);
  return getIdToken(credential.user, true);
}

/**
 * Construye usuarios locales para recorrer la aplicación sin backend activo.
 */
function buildDemoUser(role: UserRole): AuthUser {
  const names: Record<UserRole, string> = {
    empresa: "OfiAI Empresa Demo",
    profesional: "Profesional Demo OfiAI",
    admin: "Administración OfiAI",
  };

  return {
    id: `demo-${role}`,
    name: names[role],
    email: `${role}@demo.ofiai.local`,
    role,
    country: "AR",
    plan: role === "profesional" ? "profesional" : role === "empresa" ? "empresa" : "gratuito",
  };
}

/**
 * Proveedor de autenticación para rutas públicas y privadas.
 */
export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const commitSession = useCallback((session: StoredSession) => {
    setUser(session.user);
    setToken(session.token);
    persistSession(session);
  }, []);

  useEffect(() => {
    const stored = readStoredSession();
    if (configuracion.app.demoAccessEnabled && stored?.user.id.startsWith('demo-')) {
      commitSession(stored); setLoading(false); return;
    }
    if (!auth) { clearStoredSession(); setLoading(false); return; }
    let active = true;
    let revision = 0;
    const unsubscribe = onIdTokenChanged(auth, firebaseUser => {
      const currentRevision = ++revision;
      /** Impide restaurar una cuenta anterior tras salir o cambiar de usuario. */
      const isCurrent = (): boolean => active && currentRevision === revision;
      /** Verifica identidad y perfil antes de restaurar la sesion. */
      async function restore(): Promise<void> {
        try {
          if (!firebaseUser) {
            if (isCurrent()) { setUser(null); setToken(null); clearStoredSession(); }
            return;
          }
          const idToken = await firebaseUser.getIdToken();
          if (!isCurrent()) return;
          setAuthToken(idToken);
          const result = await api.get<ApiEnvelope<BackendAuthPayload>>('/auth/me', idToken);
          if (isCurrent()) commitSession({ user: normalizeUser(readApiData(result).usuario), token: idToken });
        } catch {
          if (isCurrent()) { setUser(null); setToken(null); clearStoredSession(); }
        } finally { if (isCurrent()) setLoading(false); }
      }
      void restore();
    });
    return () => { active = false; unsubscribe(); };
  }, [commitSession]);

  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    const demo = authenticateDemo(credentials.email, credentials.password);
    if (demo) {
      commitSession({ user: buildDemoUser(demo), token: "demo-token-" + demo });
      return;
    }
    setLoading(true);
    try {
      const response = await api.post<ApiEnvelope<BackendAuthPayload>>("/auth/login", credentials);
      const payload = readApiData(response);
      const sessionToken = await resolveSessionToken(payload.customToken);

      commitSession({
        user: normalizeUser(payload.usuario),
        token: sessionToken,
      });
    } finally {
      setLoading(false);
    }
  }, [commitSession]);

  const loginAsDemo = useCallback((role: UserRole): void => {
    if (!configuracion.app.demoAccessEnabled) {
      throw new Error("El acceso demo está deshabilitado en este entorno.");
    }

    const session: StoredSession = {
      user: buildDemoUser(role),
      token: `demo-token-${role}`,
    };

    commitSession(session);
  }, [commitSession]);

  const registerCompany = useCallback(async (input: RegisterCompanyInput): Promise<void> => {
    setLoading(true);
    try {
      const response = await api.post<ApiEnvelope<BackendAuthPayload>>("/auth/register/company", input);
      const payload = readApiData(response);
      const sessionToken = await resolveSessionToken(payload.customToken);

      commitSession({
        user: normalizeUser(payload.usuario),
        token: sessionToken,
      });
    } finally {
      setLoading(false);
    }
  }, [commitSession]);

  /** Conserva el intercambio Firebase y la restauracion de sesion del resto de cuentas. */
  const registerCitizen = useCallback(async (input: RegisterCitizenInput): Promise<void> => {
    setLoading(true);
    try {
      const payload = readApiData(await api.post<ApiEnvelope<BackendAuthPayload>>('/auth/register/citizen', input));
      const sessionToken = await resolveSessionToken(payload.customToken);
      commitSession({ user: normalizeUser(payload.usuario), token: sessionToken });
    } finally { setLoading(false); }
  }, [commitSession]);

  const registerProfessional = useCallback(async (input: RegisterProfessionalInput): Promise<void> => {
    setLoading(true);
    try {
      const response = await api.post<ApiEnvelope<BackendAuthPayload>>("/auth/register/professional", input);
      const payload = readApiData(response);
      const sessionToken = await resolveSessionToken(payload.customToken);

      commitSession({
        user: normalizeUser(payload.usuario),
        token: sessionToken,
      });
    } finally {
      setLoading(false);
    }
  }, [commitSession]);

  const recoverPassword = useCallback(async (email: string): Promise<void> => {
    await api.post<ApiEnvelope<unknown>>("/auth/recover-password", { email });
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    if (token && !token.startsWith("demo-token-")) {
      await api.post<ApiEnvelope<unknown>>("/auth/logout", {}).catch(() => undefined);
    }

    if (auth) {
      await signOut(auth).catch(() => undefined);
    }

    setUser(null);
    setToken(null);
    clearStoredSession();
  }, [token]);

  const value = useMemo<AuthContextType>(() => ({
    user,
    role: user?.role ?? null,
    loading,
    token,
    isAuthenticated: Boolean(user),
    demoAccessEnabled: configuracion.app.demoAccessEnabled,
    login,
    loginAsDemo,
    registerCompany,
    registerCitizen,
    registerProfessional,
    recoverPassword,
    logout,
  }), [
    user,
    loading,
    token,
    login,
    loginAsDemo,
    registerCompany,
    registerCitizen,
    registerProfessional,
    recoverPassword,
    logout,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}


/**
 * Accede al estado global de autenticación de OfiAI.
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth debe utilizarse dentro de AuthProvider"
    );
  }


  return context;
}
