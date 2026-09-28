/**
 * @archivo mobile/src/context/AuthContext.tsx
 * @descripcion Contexto de autenticación para la app móvil de OfiAI.
 * Sincronizado con Firebase Auth y el backend.
 * @modulo Mobile Context
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { getIdToken, onIdTokenChanged, signInWithCustomToken, signOut } from 'firebase/auth';
import { DEMO_ACCESS_ENABLED } from '../constants';
import { apiMobile, setApiMobileToken } from '../lib/api';
import { firebaseAuthMobile } from '../lib/firebase';
import type { ApiEnvelope, RolUsuario, UsuarioMobile } from '../types';

export interface RegistroEmpresaMobile {
  email: string;
  password: string;
  nombre: string;
  apellido?: string;
  pais: 'MX' | 'CO' | 'CL' | 'AR' | 'PE' | 'EC' | 'VE' | 'BO' | 'PY' | 'UY';
  nombreEmpresa: string;
  industria: string;
  tamanoEmpresa: 'micro' | 'pequena' | 'mediana' | 'grande';
  ciudad: string;
  telefono?: string;
}

export interface RegistroProfesionalMobile {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  pais: 'MX' | 'CO' | 'CL' | 'AR' | 'PE' | 'EC' | 'VE' | 'BO' | 'PY' | 'UY';
  especialidades: string[];
  categorias: string[];
  aniosExperiencia: number;
  ciudad: string;
  tarifaHora?: number;
  telefono?: string;
}

export interface EstadoAuthMobile {
  usuario: UsuarioMobile | null;
  cargando: boolean;
  token: string | null;
  estaAutenticado: boolean;
  demoAccessEnabled: boolean;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  iniciarSesionDemo: (rol: RolUsuario) => Promise<void>;
  registrarEmpresa: (datos: RegistroEmpresaMobile) => Promise<void>;
  registrarProfesional: (datos: RegistroProfesionalMobile) => Promise<void>;
  recuperarPassword: (email: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
}

const AuthContext = createContext<EstadoAuthMobile | undefined>(undefined);
const STORAGE_KEY = 'ofiai.mobile.auth';

interface BackendUsuario {
  id: string;
  email: string;
  nombre: string;
  apellido?: string;
  rol: RolUsuario;
  pais?: string;
}

interface BackendAuthPayload {
  usuario: BackendUsuario;
  customToken?: string;
}

interface StoredSession {
  usuario: UsuarioMobile;
  token?: string | null;
}

/**
 * Convierte el usuario de backend a modelo móvil.
 */
function normalizeUsuario(usuario: BackendUsuario): UsuarioMobile {
  return {
    uid: usuario.id,
    email: usuario.email,
    nombre: [usuario.nombre, usuario.apellido].filter(Boolean).join(' ') || usuario.email,
    rol: usuario.rol,
    pais: usuario.pais ?? 'AR',
    plan: usuario.rol === 'empresa' ? 'empresa' : usuario.rol === 'profesional' ? 'profesional' : 'gratuito',
  };
}

/**
 * Extrae datos de una respuesta estándar del backend.
 */
function unwrap<T>(response: ApiEnvelope<T>): T {
  if (!response.exito || !response.datos) {
    throw new Error(response.mensaje ?? 'La API no devolvió datos válidos.');
  }

  return response.datos;
}

/**
 * Construye una sesión demo para validar flujos móviles sin backend.
 */
function buildDemoSession(rol: RolUsuario): StoredSession {
  return {
    usuario: {
      uid: `demo-${rol}`,
      email: `${rol}@demo.ofiai.local`,
      nombre: rol === 'admin' ? 'Admin OfiAI' : rol === 'empresa' ? 'Empresa Demo' : 'Profesional Demo',
      rol,
      pais: 'AR',
      plan: rol === 'empresa' ? 'empresa' : rol === 'profesional' ? 'profesional' : 'gratuito',
    },
    token: `demo-token-${rol}`,
  };
}

/**
 * Intercambia un custom token de Firebase por un ID token aceptado por el backend.
 */
async function resolveSessionToken(customToken?: string): Promise<string | null> {
  if (!customToken) {
    return null;
  }

  if (!firebaseAuthMobile) {
    throw new Error('Firebase cliente móvil no está configurado para completar la sesión.');
  }

  const credential = await signInWithCustomToken(firebaseAuthMobile, customToken);
  return getIdToken(credential.user, true);
}

/**
 * Lee una sesión segura persistida en el dispositivo.
 */
async function readStoredSession(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as StoredSession) : null;
}

/**
 * Hook para acceder a autenticación móvil.
 */
export const useAuthMobile = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthMobile debe usarse dentro de AuthProvider');
  return ctx;
};

/**
 * Proveedor de autenticación móvil con persistencia segura.
 */
export const AuthProviderMobile = ({ children }: { children: ReactNode }) => {
  const [usuario, setUsuario] = useState<UsuarioMobile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const auth = firebaseAuthMobile;

    /**
     * Restaura la sesión persistida en el dispositivo.
     */
    async function restoreSession(): Promise<void> {
      const session = await readStoredSession().catch(() => null);

      if (auth) {
        await auth.authStateReady();
        const firebaseUser = auth.currentUser;
        if (firebaseUser) {
          const freshToken = await getIdToken(firebaseUser);
          setToken(freshToken);
          setApiMobileToken(freshToken);
          const cachedUser = session?.usuario.uid === firebaseUser.uid ? session.usuario : null;
          if (cachedUser) setUsuario(cachedUser);

          try {
            const profile = unwrap(await apiMobile.get<ApiEnvelope<{ usuario: BackendUsuario }>>('/auth/me', freshToken));
            if (profile.usuario.id !== firebaseUser.uid) throw new Error('La sesión no coincide con el perfil del servidor.');
            const usuario = normalizeUsuario(profile.usuario);
            setUsuario(usuario);
            await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify({ usuario } satisfies StoredSession));
          } catch {
            if (!cachedUser) throw new Error('No se pudo recuperar el perfil de la sesión.');
          }
          return;
        }
      }

      const demoToken = session?.token;
      if (session && typeof demoToken === 'string' && demoToken.startsWith('demo-token-') && DEMO_ACCESS_ENABLED) {
        setUsuario(session.usuario);
        setToken(demoToken);
        setApiMobileToken(demoToken);
        return;
      }

      await SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => undefined);
      setApiMobileToken(null);
    }

    const unsubscribe = auth ? onIdTokenChanged(auth, user => {
      if (!user) return;
      void getIdToken(user).then(freshToken => {
        if (auth.currentUser?.uid !== user.uid) return;
        setToken(freshToken);
        setApiMobileToken(freshToken);
      }).catch(() => undefined);
    }) : undefined;

    void restoreSession().catch(() => {
      setUsuario(null);
      setToken(null);
      setApiMobileToken(null);
    }).finally(() => {
      setCargando(false);
    });

    return () => unsubscribe?.();
  }, []);

  const commitSession = useCallback(async (session: StoredSession): Promise<void> => {
    setUsuario(session.usuario);
    setToken(session.token ?? null);
    setApiMobileToken(session.token ?? null);
    const persisted: StoredSession = session.token?.startsWith('demo-token-')
      ? session
      : { usuario: session.usuario };
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(persisted));
  }, []);

  const iniciarSesion = useCallback(async (email: string, password: string): Promise<void> => {
    setCargando(true);
    try {
      const response = await apiMobile.post<ApiEnvelope<BackendAuthPayload>>('/auth/login', { email, password });
      const payload = unwrap(response);
      const sessionToken = await resolveSessionToken(payload.customToken);

      await commitSession({
        usuario: normalizeUsuario(payload.usuario),
        token: sessionToken,
      });
    } finally {
      setCargando(false);
    }
  }, [commitSession]);

  const iniciarSesionDemo = useCallback(async (rol: RolUsuario): Promise<void> => {
    if (!DEMO_ACCESS_ENABLED) {
      throw new Error('El acceso demo está deshabilitado en este entorno.');
    }

    await commitSession(buildDemoSession(rol));
  }, [commitSession]);

  const registrarEmpresa = useCallback(async (datos: RegistroEmpresaMobile): Promise<void> => {
    setCargando(true);
    try {
      const response = await apiMobile.post<ApiEnvelope<BackendAuthPayload>>('/auth/register/company', datos);
      const payload = unwrap(response);
      const sessionToken = await resolveSessionToken(payload.customToken);

      await commitSession({
        usuario: normalizeUsuario(payload.usuario),
        token: sessionToken,
      });
    } finally {
      setCargando(false);
    }
  }, [commitSession]);

  const registrarProfesional = useCallback(async (datos: RegistroProfesionalMobile): Promise<void> => {
    setCargando(true);
    try {
      const response = await apiMobile.post<ApiEnvelope<BackendAuthPayload>>('/auth/register/professional', datos);
      const payload = unwrap(response);
      const sessionToken = await resolveSessionToken(payload.customToken);

      await commitSession({
        usuario: normalizeUsuario(payload.usuario),
        token: sessionToken,
      });
    } finally {
      setCargando(false);
    }
  }, [commitSession]);

  const recuperarPassword = useCallback(async (email: string): Promise<void> => {
    await apiMobile.post<ApiEnvelope<unknown>>('/auth/recover-password', { email });
  }, []);

  const cerrarSesion = useCallback(async (): Promise<void> => {
    if (token) {
      await apiMobile.post<ApiEnvelope<unknown>>('/auth/logout', {}, token).catch(() => undefined);
    }

    setUsuario(null);
    setToken(null);
    setApiMobileToken(null);
    if (firebaseAuthMobile) {
      await signOut(firebaseAuthMobile).catch(() => undefined);
    }
    await SecureStore.deleteItemAsync(STORAGE_KEY);
  }, [token]);

  const valor = useMemo<EstadoAuthMobile>(() => ({
    usuario,
    cargando,
    token,
    estaAutenticado: Boolean(usuario),
    demoAccessEnabled: DEMO_ACCESS_ENABLED,
    iniciarSesion,
    iniciarSesionDemo,
    registrarEmpresa,
    registrarProfesional,
    recuperarPassword,
    cerrarSesion,
  }), [
    usuario,
    cargando,
    token,
    iniciarSesion,
    iniciarSesionDemo,
    registrarEmpresa,
    registrarProfesional,
    recuperarPassword,
    cerrarSesion,
  ]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
};
