/**
 * @archivo mobile/src/context/AuthContext.tsx
 * @descripcion Contexto de autenticación para la app móvil de OfiAI.
 * Sincronizado con Firebase Auth y el backend.
 * @modulo Mobile Context
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { getIdToken, onIdTokenChanged, signInWithCustomToken, signOut } from 'firebase/auth';
import { DEMO_ACCESS_ENABLED } from '../constants';
import { ApiMobileError, apiMobile, isSessionRejected, onApiMobileSessionInvalidated, setApiMobileToken } from '../lib/api';
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

/** Perfil personal sin datos comerciales. */
export type RegistroParticularMobile = Pick<RegistroProfesionalMobile, 'email' | 'password' | 'nombre' | 'apellido' | 'pais' | 'ciudad' | 'telefono'>;

export interface EstadoAuthMobile {
  usuario: UsuarioMobile | null;
  cargando: boolean;
  token: string | null;
  estaAutenticado: boolean;
  demoAccessEnabled: boolean;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  iniciarSesionDemo: (rol: RolUsuario) => Promise<void>;
  registrarEmpresa: (datos: RegistroEmpresaMobile) => Promise<void>;
  registrarParticular: (datos: RegistroParticularMobile) => Promise<void>;
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
  financialRole?: 'OWNER';
  tipoCuenta?: RolUsuario | 'particular';
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
    financialRole: usuario.financialRole,
    tipoCuenta: usuario.tipoCuenta ?? usuario.rol,
    pais: usuario.pais ?? 'AR',
    plan: 'gratuito',
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
async function resolveSessionToken(customToken?: string): Promise<string> {
  if (!customToken) {
    throw new Error('No se pudo completar la sesion. Intenta ingresar nuevamente.');
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
  const sessionVersion = useRef(0);
  const firebaseUid = useRef<string | null>(null);
  const storageQueue = useRef<Promise<void>>(Promise.resolve());

  /** Serializa escrituras para que una restauracion tardia no persista un perfil cerrado. */
  const persistSession = useCallback((session: StoredSession | null): Promise<void> => {
    const pending = storageQueue.current.catch(() => undefined).then(async () => {
      if (!session) {
        await SecureStore.deleteItemAsync(STORAGE_KEY);
        return;
      }
      const persisted = session.token?.startsWith('demo-token-') ? session : { usuario: session.usuario };
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(persisted));
    });
    storageQueue.current = pending;
    return pending;
  }, []);

  /** Cierra inmediatamente la UI; la limpieza local no depende de la API remota. */
  const clearSession = useCallback(async (): Promise<void> => {
    sessionVersion.current += 1;
    firebaseUid.current = null;
    setUsuario(null);
    setToken(null);
    setApiMobileToken(null);
    setCargando(false);
    const removeProfile = persistSession(null);
    const firebaseSignOut = firebaseAuthMobile ? signOut(firebaseAuthMobile) : Promise.resolve();
    await Promise.all([removeProfile, firebaseSignOut]);
  }, [persistSession]);

  useEffect(() => {
    const auth = firebaseAuthMobile;
    let mounted = true;
    const version = sessionVersion.current;

    /** Evita que respuestas anteriores al logout restauren la sesion. */
    const isCurrent = (): boolean => mounted && version === sessionVersion.current;

    /**
     * Restaura la sesión persistida en el dispositivo.
     */
    async function restoreSession(): Promise<void> {
      const session = await readStoredSession().catch(() => null);
      if (!isCurrent()) return;

      if (auth) {
        await auth.authStateReady();
        if (!isCurrent()) return;
        const firebaseUser = auth.currentUser;
        if (firebaseUser) {
          firebaseUid.current = firebaseUser.uid;
          const freshToken = await getIdToken(firebaseUser);
          if (!isCurrent() || auth.currentUser?.uid !== firebaseUser.uid) return;
          setToken(freshToken);
          setApiMobileToken(freshToken);
          const cachedUser = session?.usuario.uid === firebaseUser.uid ? session.usuario : null;

          try {
            const profile = unwrap(await apiMobile.get<ApiEnvelope<{ usuario: BackendUsuario }>>('/auth/me', freshToken));
            if (!isCurrent() || auth.currentUser?.uid !== firebaseUser.uid) return;
            if (profile.usuario.id !== firebaseUser.uid) throw new ApiMobileError('La sesion no coincide con el perfil.', 403);
            const usuario = normalizeUsuario(profile.usuario);
            setUsuario(usuario);
            await persistSession({ usuario });
          } catch (error) {
            if (!isCurrent()) return;
            const transient = error instanceof TypeError ||
              (error instanceof ApiMobileError && (error.status === 0 || error.status >= 500));
            if (isSessionRejected(error) || !transient || !cachedUser) throw error;
            setUsuario(cachedUser);
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

      await persistSession(null);
      setApiMobileToken(null);
    }

    const unsubscribe = auth ? onIdTokenChanged(auth, user => {
      if (!user) {
        if (firebaseUid.current && !auth.currentUser) void clearSession().catch(() => undefined);
        return;
      }
      if (firebaseUid.current !== user.uid) return;
      const refreshVersion = sessionVersion.current;
      void getIdToken(user).then(freshToken => {
        if (!mounted || refreshVersion !== sessionVersion.current || auth.currentUser?.uid !== user.uid) return;
        setToken(freshToken);
        setApiMobileToken(freshToken);
      }).catch(error => {
        if (mounted && refreshVersion === sessionVersion.current && isSessionRejected(error)) {
          void clearSession().catch(() => undefined);
        }
      });
    }) : undefined;
    const unsubscribeApi = onApiMobileSessionInvalidated(() => { void clearSession().catch(() => undefined); });

    void restoreSession().catch(async () => {
      if (isCurrent()) await clearSession().catch(() => undefined);
    }).finally(() => {
      if (isCurrent()) setCargando(false);
    });

    return () => {
      mounted = false;
      unsubscribe?.();
      unsubscribeApi();
    };
  }, [clearSession, persistSession]);

  const commitSession = useCallback(async (session: StoredSession): Promise<void> => {
    sessionVersion.current += 1;
    firebaseUid.current = session.token?.startsWith('demo-token-') ? null : session.usuario.uid;
    setUsuario(session.usuario);
    setToken(session.token ?? null);
    setApiMobileToken(session.token ?? null);
    await persistSession(session);
  }, [persistSession]);

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

  /** Usa el mismo intercambio de custom token y persistencia nativa que las otras cuentas. */
  const registrarParticular = useCallback(async (datos: RegistroParticularMobile): Promise<void> => {
    setCargando(true);
    try {
      const payload = unwrap(await apiMobile.post<ApiEnvelope<BackendAuthPayload>>('/auth/register/citizen', datos));
      const sessionToken = await resolveSessionToken(payload.customToken);
      await commitSession({ usuario: normalizeUsuario(payload.usuario), token: sessionToken });
    } finally { setCargando(false); }
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
    const logoutToken = token;
    const cleanup = clearSession();
    if (logoutToken && !logoutToken.startsWith('demo-token-')) {
      // Revocacion remota acotada, sin bloquear el cierre ni usar un token posterior.
      void apiMobile.post<ApiEnvelope<unknown>>('/auth/logout', {}, logoutToken, 5000).catch(() => undefined);
    }
    await cleanup;
  }, [token, clearSession]);

  const valor = useMemo<EstadoAuthMobile>(() => ({
    usuario,
    cargando,
    token,
    estaAutenticado: Boolean(usuario),
    demoAccessEnabled: DEMO_ACCESS_ENABLED,
    iniciarSesion,
    iniciarSesionDemo,
    registrarEmpresa,
    registrarParticular,
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
    registrarParticular,
    registrarProfesional,
    recuperarPassword,
    cerrarSesion,
  ]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
};
