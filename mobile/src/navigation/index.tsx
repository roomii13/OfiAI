/**
 * @archivo mobile/src/navigation/index.tsx
 * @descripcion Configuración de navegación y pantallas principales para la app móvil de OfiAI.
 * Define stacks públicos, tabs autenticados y vistas por rol.
 * @modulo Mobile Navigation
 */
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { createBottomTabNavigator, type BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { COLORES_MARCA, ESPACIADO } from '../constants';
import {
  useAuthMobile,
  type RegistroEmpresaMobile,
  type RegistroProfesionalMobile,
} from '../context/AuthContext';
import { apiMobile } from '../lib/api';
import { dashboardPath, metricLabel, useMobileResource } from '../lib/resources';
import type { AccountData, AdminUserData, DashboardData, JobData, NotificationData, NotificationPreferences, ProfessionalData, SubscriptionData } from '../../../shared/contracts';
import type {
  ApiEnvelope,
  AppTabParamList,
  AuthStackParamList,
  RolUsuario,
  TrabajoMobile,
} from '../types';
import { useThemeMobile } from '../providers/theme';
import { IntakeScreen } from './IntakeScreen';
import { JobMatchesScreen } from './JobMatchesScreen';
import { JobPricingScreen } from './JobPricingScreen';
import { CoordinatorScreen } from './CoordinatorScreen';
import { JobCoordinatorScreen } from './JobCoordinatorScreen';
import { SubscriptionsScreen } from './SubscriptionsScreen';
import { AgentOperationsScreen } from './AgentOperationsScreen';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tabs = createBottomTabNavigator<AppTabParamList>();


/**
 * Router principal de la aplicación móvil.
 */
export function AppNavigator() {
  const { cargando, estaAutenticado } = useAuthMobile();
  const { modo, colores } = useThemeMobile();
  const navigationTheme = modo === 'oscuro' ? DarkTheme : DefaultTheme;
  const theme = {
    ...navigationTheme,
    colors: {
      ...navigationTheme.colors,
      primary: colores.primario,
      background: colores.fondo,
      card: colores.superficie,
      text: colores.texto,
      border: colores.borde,
    },
  };

  if (cargando) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: colores.fondo }]}>
        <ActivityIndicator color={colores.primario} size="large" />
        <Text style={[styles.loadingText, { color: colores.textoSuave }]}>Cargando OfiAI...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer theme={theme}>
      {estaAutenticado ? <AuthenticatedTabs /> : <AuthStackNavigator />}
    </NavigationContainer>
  );
}

/**
 * Stack público para login, registro y recuperación.
 */
function AuthStackNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Registro" component={RegisterScreen} />
      <AuthStack.Screen name="RecuperarPassword" component={RecoverPasswordScreen} />
    </AuthStack.Navigator>
  );
}

/**
 * Tabs principales para usuarios autenticados.
 */
function AuthenticatedTabs() {
  const { colores } = useThemeMobile();
  const { usuario } = useAuthMobile();

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colores.primario,
        tabBarInactiveTintColor: colores.textoSuave,
        tabBarStyle: {
          borderTopColor: colores.borde,
          backgroundColor: colores.superficie,
        },
      }}
    >
      <Tabs.Screen name="Dashboard" component={DashboardScreen} />
      <Tabs.Screen name="Profesionales" component={ProfessionalsScreen} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="Analytics" component={AnalyticsScreen} options={{ tabBarItemStyle: { display: 'none' } }} />
      {usuario?.rol === 'admin' && <Tabs.Screen name="Admin" component={AdminScreen} options={{ tabBarItemStyle: { display: 'none' } }} />}
      <Tabs.Screen name="Trabajos" component={JobsScreen} />
      {(usuario?.rol === 'empresa' || usuario?.rol === 'profesional') && <Tabs.Screen name="Coordinator" component={CoordinatorScreen} options={{ title: 'Coordinacion', tabBarItemStyle: { display: 'none' } }} />}
      {(usuario?.rol === 'empresa' || usuario?.rol === 'profesional') && <Tabs.Screen name="JobCoordinator" component={JobCoordinatorScreen} options={{ title: 'Acuerdo', tabBarItemStyle: { display: 'none' } }} />}
      {usuario?.rol === 'empresa' && <Tabs.Screen name="SolicitudIA" component={IntakeScreen} options={{ title: 'Solicitud IA', tabBarItemStyle: { display: 'none' } }} />}
      {usuario?.rol === 'empresa' && <Tabs.Screen name="JobMatches" component={JobMatchesScreen} options={{ title: 'Candidatos', tabBarItemStyle: { display: 'none' } }} />}
      {usuario?.rol === 'empresa' && <Tabs.Screen name="JobPricing" component={JobPricingScreen} options={{ title: 'Estimacion', tabBarItemStyle: { display: 'none' } }} />}
      <Tabs.Screen name="Perfil" component={ProfileScreen} />
      <Tabs.Screen name="Suscripciones" component={SubscriptionsScreen} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="Operaciones" component={AgentOperationsScreen} options={{ tabBarItemStyle: { display: 'none' } }} />
      <Tabs.Screen name="IA" component={AiScreen} />
      <Tabs.Screen name="Notificaciones" component={NotificationsScreen} />
      <Tabs.Screen name="Configuracion" component={SettingsScreen} options={{ title: 'Config' }} />
    </Tabs.Navigator>
  );
}

/**
 * Pantalla de login móvil.
 */
function LoginScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, 'Login'>) {
  const { iniciarSesion, iniciarSesionDemo, cargando, demoAccessEnabled } = useAuthMobile();
  const { colores } = useThemeMobile();
  const [email, setEmail] = useState('empresa@ofiai.com');
  const [password, setPassword] = useState('');

  /**
   * Envía credenciales al backend de OfiAI.
   */
  async function handleLogin(): Promise<void> {
    try {
      await iniciarSesion(email, password);
    } catch (error) {
      Alert.alert('No se pudo ingresar', getErrorMessage(error));
    }
  }

  /**
   * Inicia una sesión demo para recorrer la app en entornos no productivos.
   */
  async function handleDemo(rol: RolUsuario): Promise<void> {
    try {
      await iniciarSesionDemo(rol);
    } catch (error) {
      Alert.alert('Demo no disponible', getErrorMessage(error));
    }
  }

  return (
    <ScreenContainer>
      <View style={styles.heroBlock}>
        <Text style={[styles.brand, { color: colores.primario }]}>OfiAI</Text>
        <Text style={[styles.title, { color: colores.texto }]}>Operación móvil para oficios</Text>
        <Text style={[styles.subtitle, { color: colores.textoSuave }]}>
          Gestioná trabajos, IA, notificaciones y perfil desde el celular.
        </Text>
      </View>

      <Section title="Ingresar">
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
        <PrimaryButton label={cargando ? 'Ingresando...' : 'Ingresar'} onPress={() => void handleLogin()} disabled={cargando} />
        <SecondaryButton label="Recuperar contraseña" onPress={() => navigation.navigate('RecuperarPassword')} />
      </Section>

      {demoAccessEnabled ? (
        <Section title="Demo rápida">
          <View style={styles.inlineButtons}>
            <SmallButton label="Empresa" onPress={() => void handleDemo('empresa')} />
            <SmallButton label="Profesional" onPress={() => void handleDemo('profesional')} />
            <SmallButton label="Admin" onPress={() => void handleDemo('admin')} />
          </View>
          <SecondaryButton label="Crear cuenta" onPress={() => navigation.navigate('Registro')} />
        </Section>
      ) : (
        <Section title="Cuenta">
          <SecondaryButton label="Crear cuenta" onPress={() => navigation.navigate('Registro')} />
        </Section>
      )}
    </ScreenContainer>
  );
}

/**
 * Pantalla de registro móvil para empresas y profesionales.
 */
function RegisterScreen({ route }: NativeStackScreenProps<AuthStackParamList, 'Registro'>) {
  const { registrarEmpresa, registrarProfesional, cargando } = useAuthMobile();
  const [rol, setRol] = useState<Exclude<RolUsuario, 'admin'>>(route.params?.rol ?? 'empresa');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [especialidades, setEspecialidades] = useState('Mantenimiento');

  /**
   * Envía el registro al endpoint correspondiente al rol elegido.
   */
  async function handleRegister(): Promise<void> {
    try {
      if (rol === 'empresa') {
        const empresa: RegistroEmpresaMobile = {
          email,
          password,
          nombre,
          pais: 'AR',
          nombreEmpresa: nombre,
          industria: 'Servicios',
          tamanoEmpresa: 'pequena',
          ciudad,
        };

        await registrarEmpresa(empresa);
        return;
      }

      const profesional: RegistroProfesionalMobile = {
        email,
        password,
        nombre,
        apellido: 'OfiAI',
        pais: 'AR',
        especialidades: parseCsv(especialidades),
        categorias: parseCsv(especialidades),
        aniosExperiencia: 1,
        ciudad,
      };

      await registrarProfesional(profesional);
    } catch (error) {
      Alert.alert('Registro no completado', getErrorMessage(error));
    }
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Crear cuenta</Text>
      <View style={styles.inlineButtons}>
        <SmallButton label="Empresa" active={rol === 'empresa'} onPress={() => setRol('empresa')} />
        <SmallButton label="Profesional" active={rol === 'profesional'} onPress={() => setRol('profesional')} />
      </View>
      <Section title={rol === 'empresa' ? 'Datos de empresa' : 'Datos profesionales'}>
        <Field label={rol === 'empresa' ? 'Empresa o contacto' : 'Nombre'} value={nombre} onChangeText={setNombre} />
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
        <Field label="Ciudad" value={ciudad} onChangeText={setCiudad} />
        {rol === 'profesional' && (
          <Field label="Especialidades" value={especialidades} onChangeText={setEspecialidades} />
        )}
        <PrimaryButton label={cargando ? 'Registrando...' : 'Crear cuenta'} onPress={() => void handleRegister()} disabled={cargando} />
      </Section>
    </ScreenContainer>
  );
}

/**
 * Pantalla de recuperación de contraseña.
 */
function RecoverPasswordScreen() {
  const { recuperarPassword } = useAuthMobile();
  const [email, setEmail] = useState('');

  /**
   * Solicita recuperación de contraseña al backend.
   */
  async function handleRecover(): Promise<void> {
    await recuperarPassword(email).catch(() => undefined);
    Alert.alert('Solicitud recibida', 'Si el correo existe, vas a recibir un enlace de recuperación.');
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Recuperar contraseña</Text>
      <Section title="Email de la cuenta">
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <PrimaryButton label="Enviar enlace" onPress={() => void handleRecover()} />
      </Section>
    </ScreenContainer>
  );
}

/**
 * Dashboard móvil con KPIs por rol.
 */
function DashboardScreen() {
  const { usuario } = useAuthMobile();
  const navigation = useNavigation<BottomTabNavigationProp<AppTabParamList>>();
  const resource = useMobileResource<DashboardData>(dashboardPath(usuario?.rol ?? 'empresa'));
  return <ScreenContainer>
    <Text style={styles.title}>Hola, {usuario?.nombre}</Text>
    {usuario?.rol === 'empresa' && <PrimaryButton label="Crear solicitud con IA" onPress={() => navigation.navigate('SolicitudIA')} />}
    <ResourceState resource={resource} />
    <View style={styles.metricGrid}>{Object.entries(resource.data?.kpis ?? {}).map(([key, value]) =>
      <MetricCard key={key} label={metricLabel(key)} value={typeof value === 'boolean' ? (value ? 'Si' : 'No') : String(value)} detail="" />)}</View>
    <SecondaryButton label="Profesionales" onPress={() => navigation.navigate('Profesionales')} />
    <SecondaryButton label="Analytics" onPress={() => navigation.navigate('Analytics')} />
    {(usuario?.rol === 'empresa' || usuario?.rol === 'profesional') && <SecondaryButton label="Coordinaciones" onPress={() => navigation.navigate('Coordinator')} />}
    {usuario?.rol === 'admin' && <SecondaryButton label="Administracion" onPress={() => navigation.navigate('Admin')} />}
    <Section title="Actividad reciente">
      {resource.data?.actividadReciente.length === 0 && <Text>Sin actividad reciente.</Text>}
      {resource.data?.actividadReciente.map(item => <ListRow key={item.id} title={item.titulo} description={item.descripcion} badge={new Date(item.fecha).toLocaleDateString()} />)}
    </Section>
  </ScreenContainer>;
}

/** Publica trabajos persistidos y vuelve a consultar al recuperar el foco. */
function JobsScreen() {
  const { usuario } = useAuthMobile();
  const navigation = useNavigation<BottomTabNavigationProp<AppTabParamList>>();
  const resource = useMobileResource<JobData[]>('/jobs?limite=100');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoria, setCategoria] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  /** Publica la solicitud y espera confirmacion antes de limpiar el formulario. */
  async function handleAddJob(): Promise<void> {
    if (pending) return;
    if (titulo.trim().length < 5 || descripcion.trim().length < 20 || !categoria.trim() || !ciudad.trim()) {
      setError('Completa titulo, descripcion detallada, categoria y ciudad.'); return;
    }
    setPending(true); setError('');
    try {
      await apiMobile.post('/jobs', { titulo: titulo.trim(), descripcion: descripcion.trim(), categoria: categoria.trim(),
        ciudad: ciudad.trim(), tipoTrabajo: 'presencial', moneda: 'ARS' });
      setTitulo(''); setDescripcion(''); resource.reload();
    } catch (failure) { setError(getErrorMessage(failure)); }
    finally { setPending(false); }
  }
  return <ScreenContainer>
    <Text style={styles.title}>Trabajos</Text>
    {(usuario?.rol === 'empresa' || usuario?.rol === 'profesional') && <SecondaryButton label="Bandeja de coordinaciones" onPress={() => navigation.navigate('Coordinator')} />}
    {usuario?.rol === 'empresa' && <PrimaryButton label="Crear solicitud con IA" onPress={() => navigation.navigate('SolicitudIA')} />}
    {usuario?.rol === 'empresa' && <Section title="Publicar trabajo">
      <Field label="Titulo" value={titulo} onChangeText={setTitulo} />
      <Field label="Descripcion" value={descripcion} onChangeText={setDescripcion} multiline />
      <Field label="Categoria" value={categoria} onChangeText={setCategoria} />
      <Field label="Ciudad" value={ciudad} onChangeText={setCiudad} />
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <PrimaryButton label={pending ? 'Publicando...' : 'Publicar trabajo'} disabled={pending} onPress={() => void handleAddJob()} />
    </Section>}
    <Section title="Trabajos recientes">
      <ResourceState resource={resource} />
      {resource.data?.length === 0 && <Text>No hay trabajos para mostrar.</Text>}
      {resource.data?.map(job => <View key={job.id}>
        <ListRow title={job.titulo} description={`${job.categoria} · ${job.ciudad ?? ''}`} badge={formatEstadoTrabajo(job.estado)} />
        {usuario?.rol === 'empresa' && !['cancelado', 'completado'].includes(job.estado) &&
          <PrimaryButton label="Ver candidatos" onPress={() => navigation.navigate('JobMatches', { jobId: job.id })} />}
      </View>)}
    </Section>
  </ScreenContainer>;
}

/** Obtiene el perfil y la suscripcion actual del usuario. */
function ProfileScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<AppTabParamList>>();
  const account = useMobileResource<AccountData>('/auth/me');
  const subscription = useMobileResource<SubscriptionData | null>('/subscriptions/me');
  return <ScreenContainer>
    <Text style={styles.title}>Perfil</Text>
    <PrimaryButton label="Operaciones, soporte y agentes" onPress={() => navigation.navigate('Operaciones')} />
    <ResourceState resource={account} />
    {account.data && <Section title="Cuenta">
      <ListRow title="Nombre" description={`${account.data.usuario.nombre} ${account.data.usuario.apellido ?? ''}`} />
      <ListRow title="Email" description={account.data.usuario.email} />
      <ListRow title="Rol" description={account.data.usuario.rol} />
    </Section>}
    <Section title="Suscripcion">
      <PrimaryButton label="Planes y facturacion" onPress={() => navigation.navigate('Suscripciones')} />
      <ResourceState resource={subscription} />
      {subscription.data && <ListRow title={subscription.data.plan} description={subscription.data.estado} badge={subscription.data.renovacionAutomatica ? 'Renovacion mensual' : 'Sin renovacion'} />}
      {subscription.data === null && <Text>Sin suscripcion activa.</Text>}
    </Section>
  </ScreenContainer>;
}

/**
 * Vista móvil de asistente IA.
 */
function AiScreen() {
  const { token } = useAuthMobile();
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('Describí un trabajo, ciudad y urgencia para recibir una respuesta operativa.');

  /**
   * Envía el prompt al backend de IA con fallback local.
   */
  async function handleAsk(): Promise<void> {
    if (!prompt.trim()) {
      return;
    }

    try {
      const response = await apiMobile.post<ApiEnvelope<{ respuesta: string }>>('/ai/chat', { mensaje: prompt }, token ?? undefined);
      setAnswer(response.datos?.respuesta ?? 'La IA respondió sin contenido adicional.');
    } catch {
      setAnswer('Regla local: priorizá profesionales disponibles, misma ciudad, mejor calificación y mayor compatibilidad con la categoría.');
    }
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Asistente IA</Text>
      <Section title="Consulta">
        <Field label="Mensaje" value={prompt} onChangeText={setPrompt} multiline />
        <PrimaryButton label="Preguntar" onPress={() => void handleAsk()} />
      </Section>
      <Section title="Respuesta">
        <Text style={styles.bodyText}>{answer}</Text>
      </Section>
    </ScreenContainer>
  );
}

/**
 * Vista móvil de notificaciones.
 */
function NotificationsScreen() {
  const resource = useMobileResource<NotificationData[]>('/notifications');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  /** Confirma la lectura de una notificacion en el servidor. */
  async function read(id: string): Promise<void> {
    setPending(id); setError('');
    try { await apiMobile.post(`/notifications/${id}/read`, {}); resource.reload(); }
    catch (failure) { setError(getErrorMessage(failure)); }
    finally { setPending(null); }
  }
  return <ScreenContainer><Text style={styles.title}>Notificaciones</Text>
    <ResourceState resource={resource} />
    {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    {resource.data?.length === 0 && <Text>No tenes notificaciones.</Text>}
    {resource.data?.map(item => <View key={item.id}>
      <ListRow title={item.titulo} description={item.mensaje} badge={item.leida ? 'Leida' : 'Nueva'} />
      {!item.leida && <PrimaryButton disabled={pending !== null} label="Marcar como leida" onPress={() => void read(item.id)} />}
    </View>)}
  </ScreenContainer>;
}

/** Guarda preferencias de canales y conserva las opciones locales de tema. */
function SettingsScreen() {
  const { cerrarSesion } = useAuthMobile();
  const { modo, alternarTema } = useThemeMobile();
  const resource = useMobileResource<AccountData>('/auth/me');
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const preferences = draft ?? resource.data?.usuario.preferenciasNotificaciones ?? { email: true, push: true, whatsapp: true, in_app: true };
  /** Persiste las preferencias en la cuenta del usuario. */
  async function save(): Promise<void> {
    setPending(true); setMessage('');
    try { await apiMobile.put('/auth/preferences', preferences); resource.reload(); setMessage('Preferencias guardadas.'); }
    catch (error) { setMessage(getErrorMessage(error)); }
    finally { setPending(false); }
  }
  return <ScreenContainer><Text style={styles.title}>Configuracion</Text>
    <Section title="Preferencias">
      <SwitchRow label="Modo oscuro" value={modo === 'oscuro'} onValueChange={alternarTema} />
      <ResourceState resource={resource} />
      {resource.data && (Object.keys(preferences) as Array<keyof NotificationPreferences>).map(key =>
        <SwitchRow key={key} label={key === 'in_app' ? 'Internas' : metricLabel(key)} value={preferences[key]}
          onValueChange={value => setDraft({ ...preferences, [key]: value })} />)}
      <PrimaryButton label="Guardar" disabled={pending || !resource.data} onPress={() => void save()} />
      {message ? <Text>{message}</Text> : null}
    </Section>
    <SecondaryButton label="Cerrar sesion" onPress={() => void cerrarSesion()} />
  </ScreenContainer>;
}

/** Directorio de profesionales consultado desde el dashboard. */
function ProfessionalsScreen() {
  const resource = useMobileResource<ProfessionalData[]>('/professionals?limite=100');
  const [query, setQuery] = useState('');
  const filtered = (resource.data ?? []).filter(pro => `${pro.nombre} ${pro.apellido} ${pro.especialidades.join(' ')} ${pro.ciudad}`.toLowerCase().includes(query.toLowerCase()));
  return <ScreenContainer><Text style={styles.title}>Profesionales</Text>
    <Field label="Buscar" value={query} onChangeText={setQuery} /><ResourceState resource={resource} />
    {!resource.loading && !resource.error && filtered.length === 0 && <Text>Sin resultados.</Text>}
    {filtered.map(pro => <ListRow key={pro.id} title={`${pro.nombre} ${pro.apellido}`} description={`${pro.especialidades.join(', ')} · ${pro.ciudad}`} badge={pro.disponible ? 'Disponible' : 'No disponible'} />)}
  </ScreenContainer>;
}

/** Limita analytics a metricas propias salvo para administradores. */
function AnalyticsScreen() {
  const { usuario } = useAuthMobile();
  const admin = usuario?.rol === 'admin';
  const metrics = useMobileResource<Record<string, number>>(admin ? '/analytics/kpis' : null);
  const own = useMobileResource<DashboardData>(admin ? null : dashboardPath(usuario?.rol ?? 'empresa'));
  return <ScreenContainer><Text style={styles.title}>Analytics</Text>
    <ResourceState resource={admin ? metrics : own} />
    {Object.entries(admin ? metrics.data ?? {} : own.data?.metricas ?? {}).map(([label, value]) =>
      <ListRow key={label} title={metricLabel(label)} description={String(value)} />)}
  </ScreenContainer>;
}

/** Consulta las cuentas desde una pantalla disponible solo para administradores. */
function AdminScreen() {
  const { usuario } = useAuthMobile();
  const resource = useMobileResource<AdminUserData[]>(usuario?.rol === 'admin' ? '/admin/users' : null);
  return <ScreenContainer><Text style={styles.title}>Administracion</Text>
    <ResourceState resource={resource} />
    {resource.data?.length === 0 && <Text>Sin usuarios.</Text>}
    {resource.data?.map(user => <ListRow key={user.id} title={user.nombre} description={user.email} badge={user.activo ? user.rol : 'Suspendido'} />)}
  </ScreenContainer>;
}

/** Presenta carga, error y reintento sin sustituir datos por ejemplos. */
function ResourceState({ resource }: { resource: { loading: boolean; error: string; reload: () => void } }) {
  if (resource.loading) return <ActivityIndicator accessibilityLabel="Cargando" />;
  if (resource.error) return <View><Text accessibilityRole="alert">{resource.error}</Text><SecondaryButton label="Reintentar" onPress={resource.reload} /></View>;
  return <SecondaryButton label="Actualizar" onPress={resource.reload} />;
}

/**
 * Contenedor base para pantallas con scroll y tema.
 */
function ScreenContainer({ children }: { children: ReactNode }) {
  const { colores } = useThemeMobile();

  return (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      style={[styles.screen, { backgroundColor: colores.fondo }]}
    >
      {children}
    </ScrollView>
  );
}

/**
 * Bloque visual reutilizable para contenido agrupado.
 */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colores } = useThemeMobile();

  return (
    <View style={[styles.section, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
      <Text style={[styles.sectionTitle, { color: colores.texto }]}>{title}</Text>
      {children}
    </View>
  );
}

/**
 * Campo de entrada móvil con etiqueta.
 */
function Field({
  label,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  multiline?: boolean;
}) {
  const { colores } = useThemeMobile();

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colores.textoSuave }]}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        style={[
          styles.input,
          multiline ? styles.textArea : null,
          { borderColor: colores.borde, color: colores.texto, backgroundColor: colores.fondo },
        ]}
        value={value}
      />
    </View>
  );
}

/**
 * Botón primario móvil.
 */
function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.primaryButton, disabled ? styles.disabledButton : null]}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Botón secundario móvil.
 */
function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colores } = useThemeMobile();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.secondaryButton, { borderColor: colores.borde }]}
    >
      <Text style={[styles.secondaryButtonText, { color: colores.texto }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Botón pequeño usado para selección de rol.
 */
function SmallButton({
  label,
  onPress,
  active,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.smallButton, active ? styles.smallButtonActive : null]}
    >
      <Text style={[styles.smallButtonText, active ? styles.smallButtonTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Tarjeta compacta de KPI.
 */
function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  const { colores } = useThemeMobile();

  return (
    <View style={[styles.metricCard, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
      <Text style={[styles.metricLabel, { color: colores.textoSuave }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: colores.texto }]}>{value}</Text>
      <Text style={[styles.metricDetail, { color: colores.exito }]}>{detail}</Text>
    </View>
  );
}

/**
 * Fila simple para listados de mobile.
 */
function ListRow({ title, description, badge }: { title: string; description: string; badge?: string }) {
  const { colores } = useThemeMobile();

  return (
    <View style={[styles.listRow, { borderColor: colores.borde }]}>
      <View style={styles.listRowContent}>
        <Text style={[styles.listTitle, { color: colores.texto }]}>{title}</Text>
        <Text style={[styles.listDescription, { color: colores.textoSuave }]}>{description}</Text>
      </View>
      {badge ? <Text style={[styles.badge, { color: colores.primario }]}>{badge}</Text> : null}
    </View>
  );
}

/**
 * Fila con switch de configuración.
 */
function SwitchRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { colores } = useThemeMobile();

  return (
    <View style={[styles.switchRow, { borderColor: colores.borde }]}>
      <Text style={[styles.listTitle, { color: colores.texto }]}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: colores.primario, false: colores.borde }} />
    </View>
  );
}


/**
 * Formatea el estado técnico de trabajo.
 */
function formatEstadoTrabajo(estado: TrabajoMobile['estado']): string {
  const labels: Record<TrabajoMobile['estado'], string> = {
    borrador: 'Borrador',
    en_revision: 'En revision',
    publicado: 'Publicado',
    en_progreso: 'En progreso',
    completado: 'Completado',
    cancelado: 'Cancelado',
  };

  return labels[estado];
}

/**
 * Convierte listas separadas por coma en arreglos limpios.
 */
function parseCsv(value: string): string[] {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

/**
 * Obtiene un mensaje legible a partir de errores desconocidos.
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: ESPACIADO.md,
  },
  screen: {
    flex: 1,
  },
  screenContent: {
    gap: ESPACIADO.md,
    padding: ESPACIADO.lg,
    paddingBottom: 96,
  },
  heroBlock: {
    marginTop: ESPACIADO.xl,
  },
  brand: {
    fontSize: 24,
    fontWeight: '800',
  },
  title: {
    color: COLORES_MARCA.texto,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 15,
    lineHeight: 22,
    marginTop: ESPACIADO.sm,
  },
  bodyText: {
    color: COLORES_MARCA.texto,
    fontSize: 15,
    lineHeight: 22,
  },
  section: {
    borderRadius: 8,
    borderWidth: 1,
    gap: ESPACIADO.md,
    padding: ESPACIADO.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  field: {
    gap: ESPACIADO.xs,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: ESPACIADO.md,
  },
  textArea: {
    minHeight: 104,
    paddingTop: ESPACIADO.md,
    textAlignVertical: 'top',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: COLORES_MARCA.primario,
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.md,
  },
  disabledButton: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.md,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  inlineButtons: {
    flexDirection: 'row',
    gap: ESPACIADO.sm,
  },
  smallButton: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    flex: 1,
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: ESPACIADO.sm,
  },
  smallButtonActive: {
    backgroundColor: COLORES_MARCA.primario,
  },
  smallButtonText: {
    color: COLORES_MARCA.texto,
    fontSize: 13,
    fontWeight: '700',
  },
  smallButtonTextActive: {
    color: '#ffffff',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ESPACIADO.sm,
  },
  metricCard: {
    borderRadius: 8,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    gap: ESPACIADO.xs,
    padding: ESPACIADO.md,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  metricDetail: {
    fontSize: 13,
    fontWeight: '700',
  },
  listRow: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: ESPACIADO.md,
    justifyContent: 'space-between',
    paddingVertical: ESPACIADO.sm,
  },
  listRowContent: {
    flex: 1,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  listDescription: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  badge: {
    fontSize: 12,
    fontWeight: '800',
  },
  switchRow: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: ESPACIADO.sm,
  },
});
