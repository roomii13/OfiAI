/**
 * @archivo IntakeScreen.tsx
 * @descripcion Intake nativo con contexto persistido, teclado comodo y confirmacion de resumen.
 */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuthMobile } from '../context/AuthContext';
import { useThemeMobile } from '../providers/theme';
import { useMobileResource } from '../lib/resources';
import { request } from '../lib/api';
import type { AppTabParamList } from '../types';
import type { ApiResult } from '../../../shared/contracts';
import type { IntakeField, IntakeSession, IntakeSessionSummary } from '../../../shared/intake';

const fieldLabels: Record<IntakeField, string> = {
  category: 'Categoria', title: 'Titulo', description: 'Detalle', location: 'Pais y ciudad',
  urgency: 'Urgencia', preferredDate: 'Fecha', estimatedScope: 'Alcance', requirements: 'Requisitos',
  budget: 'Presupuesto', attachments: 'Fotos o documentos', workType: 'Modalidad',
};
const urgencyLabels = { low: 'Baja', normal: 'Normal', high: 'Alta', emergency: 'Emergencia' };

/** Identifica reintentos; no es una credencial ni un mecanismo de autorizacion. */
function commandId(): string {
  return 'intake_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

/** Evita esperas indefinidas y conserva la sesion si la conexion se pierde. */
async function postIntake(path: string, body: unknown): Promise<IntakeSession> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75000);
  try {
    const result = await request<ApiResult<IntakeSession>>(path, { method: 'POST', body: JSON.stringify(body), signal: controller.signal });
    if (!result.exito) throw new Error('No pudimos completar la accion. Actualiza la conversacion.');
    return result.datos;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('La respuesta esta tardando. Actualiza antes de reintentar.');
    if (error instanceof TypeError) throw new Error('No pudimos conectar. Tu mensaje sigue aqui; revisa la conexion.');
    throw error;
  } finally { clearTimeout(timeout); }
}

/** Aisla la interfaz por cuenta, sin permitir simular roles desde el dispositivo. */
export function IntakeScreen() {
  const { usuario } = useAuthMobile();
  if (usuario?.rol !== 'empresa') return <Text>Esta funcion esta disponible para empresas.</Text>;
  return <IntakeConversation key={usuario.uid} />;
}

/** Conversacion movil que usa exclusivamente la API autenticada del backend. */
function IntakeConversation() {
  const { colores, modo } = useThemeMobile();
  const navigation = useNavigation<BottomTabNavigationProp<AppTabParamList>>();
  const [id, setId] = useState<string | null>(null);
  const history = useMobileResource<IntakeSessionSummary[]>('/ai/intake/sessions');
  const loaded = useMobileResource<IntakeSession>(id ? '/ai/intake/sessions/' + encodeURIComponent(id) : null);
  const [local, setLocal] = useState<IntakeSession | null>(null);
  const session = local?.id === id ? local : loaded.data;
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const locked = useRef(false);
  const alive = useRef(true);
  const input = useRef<TextInput>(null);
  const scroll = useRef<ScrollView>(null);
  const startId = useRef(commandId());
  const pending = useRef<{ requestId: string; message: string; version: number; sessionId: string } | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (session?.readyToCreateJob) setShowSummary(true); }, [session?.readyToCreateJob]);
  const closed = session?.status === 'published' || session?.status === 'abandoned';

  /** Serializa comandos y conserva borradores ante errores. */
  async function perform(label: string, action: () => Promise<IntakeSession>, after?: () => void): Promise<void> {
    if (locked.current) return;
    locked.current = true; setBusy(label); setError('');
    try {
      const result = await action();
      if (!alive.current) return;
      setId(result.id); setLocal(result); history.reload(); after?.();
    } catch (failure) {
      if (alive.current) setError(failure instanceof Error ? failure.message : 'No pudimos completar la accion.');
    } finally { locked.current = false; if (alive.current) setBusy(''); }
  }

  /** Inicia una solicitud sin crear todavia un trabajo. */
  function start(): void {
    void perform('new', () => postIntake('/ai/intake/sessions', { requestId: startId.current }), () => {
      startId.current = commandId(); pending.current = null; setDraft(''); setShowSummary(false); setShowHistory(false);
    });
  }

  /** Envia solo texto y control de version, nunca estado confiable del trabajo. */
  function send(): void {
    if (!session || !draft.trim() || closed) return;
    const message = draft.trim();
    if (!pending.current || pending.current.message !== message || pending.current.sessionId !== session.id) {
      pending.current = { requestId: commandId(), message, version: session.version, sessionId: session.id };
    }
    const command = pending.current;
    void perform('message', () => postIntake('/ai/intake/sessions/' + session.id + '/messages', {
      requestId: command.requestId, expectedVersion: command.version, message,
    }), () => { setDraft(''); pending.current = null; });
  }

  /** Refresca la version autoritativa despues de un fallo o cambio en otro dispositivo. */
  function refresh(): void {
    if (locked.current) return;
    setLocal(null); pending.current = null; loaded.reload(); history.reload(); setError('');
  }

  /** Solicita confirmacion nativa despues de revisar el resumen completo. */
  function confirm(): void {
    if (!session || !session.readyToCreateJob || draft.trim() || busy) return;
    Alert.alert('Publicar solicitud', 'Confirmas que el resumen es correcto y queres publicarlo?', [
      { text: 'Volver', style: 'cancel' },
      { text: 'Publicar', onPress: () => void perform('confirm', () => postIntake('/ai/intake/sessions/' + session.id + '/confirm', { confirmed: true, expectedVersion: session.version })) },
    ]);
  }

  const data = session?.extractedData;
  const details = {
    Trabajo: data?.title, Categoria: data?.category,
    Ubicacion: [data?.location.city, data?.location.region, data?.location.country].filter(Boolean).join(', '),
    Urgencia: data?.urgency ? urgencyLabels[data.urgency] : null, Fecha: data?.preferredDate,
    Presupuesto: data?.budgetStatus === 'to_quote' ? 'A cotizar' : data && (data.budget.min !== null || data.budget.max !== null)
      ? [data.budget.min ?? 'Sin minimo', data.budget.max ?? 'Sin maximo', data.budget.currency ?? 'Moneda por confirmar'].join(' · ') : null,
    Alcance: data?.estimatedScope, Modalidad: data?.workType, Requisitos: data?.requirements.join(', '),
    Adjuntos: data?.attachmentsRequired ? data.attachmentReason ?? 'Se recomiendan fotos o documentos' : data?.attachmentsRequired === false ? 'No requeridos' : null,
    Equipo: data?.multipleProfessionals ? data.professionalTypes.join(', ') || 'Podrian necesitarse varios profesionales' : data?.multipleProfessionals === false ? 'Un profesional' : null,
  };
  return <SafeAreaView style={[styles.root, { backgroundColor: colores.fondo }]} edges={['top', 'left', 'right']}>
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.header, { borderColor: colores.borde }]}>
        <Text style={[styles.title, { color: colores.texto }]}>Solicitud con IA</Text>
        <View style={styles.row}>
          <Action label="Nueva" disabled={Boolean(busy)} onPress={start} />
          <Action label="Conversaciones" disabled={Boolean(busy)} onPress={() => setShowHistory(value => !value)} />
          <Action label="Actualizar" disabled={Boolean(busy)} onPress={refresh} />
        </View>
      </View>
      {showHistory && <ScrollView style={styles.history}>
        {history.loading && <ActivityIndicator accessibilityLabel="Cargando conversaciones" />}
        {history.data?.length === 0 && <Text style={{ color: colores.texto }}>No hay conversaciones anteriores.</Text>}
        {history.data?.map(item => <Pressable key={item.id} accessibilityRole="button" disabled={Boolean(busy)} onPress={() => {
          setLocal(null); setId(item.id); setDraft(''); pending.current = null; setShowHistory(false); setError('');
        }} style={styles.historyItem}><Text style={{ color: colores.texto }}>{item.title}</Text><Text style={{ color: colores.textoSuave }}>{item.status === 'published' ? 'Publicada' : item.status === 'abandoned' ? 'Cerrada' : 'Continuar conversacion'}</Text></Pressable>)}
      </ScrollView>}
      {(error || loaded.error || history.error) && <Text accessibilityRole="alert" style={styles.error}>{error || loaded.error || history.error}</Text>}
      <ScrollView ref={scroll} style={styles.messages} contentContainerStyle={styles.messageContent} keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => { if (!showSummary) scroll.current?.scrollToEnd({ animated: false }); }}>
        {!session && <Text style={{ color: colores.texto }}>Hola, contame que servicio necesita tu empresa. Podemos empezar una nueva conversacion.</Text>}
        {id && loaded.loading && !local && <ActivityIndicator accessibilityLabel="Recuperando conversacion" />}
        {session?.messages.map(message => <View key={message.id} style={[styles.message, {
          alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
          backgroundColor: modo === 'oscuro' ? colores.superficie : message.role === 'user' ? '#e3f1fb' : '#efe6f8',
        }]}>
          <Text style={[styles.author, { color: colores.texto }]}>{message.role === 'user' ? 'Vos' : 'OfiAI'}</Text>
          <Text style={[styles.messageText, { color: colores.texto }]}>{message.content}</Text>
        </View>)}
        {busy === 'message' && <View style={styles.row}><ActivityIndicator /><Text style={{ color: colores.texto }}>La IA esta analizando...</Text></View>}
        {showSummary && <View style={styles.summary}>
          <Text style={[styles.title, { color: colores.texto }]}>Resumen del trabajo</Text>
          {Object.entries(details).map(([label, value]) => <View key={label} style={[styles.detail, { borderColor: colores.borde }]}>
            <Text style={{ color: colores.textoSuave }}>{label}</Text><Text style={[styles.messageText, { color: colores.texto }]}>{value || 'Por definir'}</Text>
          </View>)}
          {data?.description && <Text style={[styles.messageText, { color: colores.texto }]}>{data.description}</Text>}
          {Boolean(session?.missingInformation.length) && <Text style={{ color: colores.textoSuave }}>Falta completar: {session?.missingInformation.map(field => fieldLabels[field]).join(', ')}</Text>}
          {session?.readyToCreateJob && !closed && <View style={styles.actions}>
            <Action label={busy === 'confirm' ? 'Publicando...' : 'Publicar solicitud'} primary disabled={Boolean(busy) || Boolean(draft.trim())} onPress={confirm} />
            <Action label="Editar informacion" disabled={Boolean(busy)} onPress={() => { setDraft('Quiero corregir: '); setShowSummary(false); input.current?.focus(); }} />
            <Action label="Seguir hablando con IA" disabled={Boolean(busy)} onPress={() => { setShowSummary(false); input.current?.focus(); }} />
          </View>}
          {session && !closed && <Action label="Cerrar conversacion" disabled={Boolean(busy)} onPress={() => Alert.alert('Cerrar conversacion', 'La solicitud no se publicara.', [
            { text: 'Volver', style: 'cancel' },
            { text: 'Cerrar', onPress: () => void perform('abandon', () => postIntake('/ai/intake/sessions/' + session.id + '/abandon', { expectedVersion: session.version })) },
          ])} />}
        </View>}
        {session?.status === 'published' && <View style={styles.actions}><Text style={{ color: colores.texto }}>Solicitud publicada</Text>
          {session.jobId && <Action label="Ver profesionales recomendados" primary onPress={() => navigation.navigate('JobMatches', { jobId: session.jobId! })} />}
          <Action label="Ver mis trabajos" onPress={() => navigation.navigate('Trabajos')} /></View>}
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showSummary }} onPress={() => setShowSummary(value => !value)} style={[styles.progress, { backgroundColor: colores.superficie }]}>
        <Text style={{ color: colores.texto }}>{showSummary ? 'Ocultar resumen' : 'Ver resumen'} · {session?.completionPercentage ?? 0}%</Text>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: (session?.completionPercentage ?? 0) + '%' as `${number}%` }]} /></View>
      </Pressable>
      <View style={[styles.composer, { backgroundColor: colores.superficie, borderColor: colores.borde }]}>
        <TextInput ref={input} accessibilityLabel="Tu mensaje" placeholder="Tu mensaje" placeholderTextColor={colores.textoSuave}
          multiline maxLength={4000} value={draft} onChangeText={setDraft} editable={Boolean(session) && !closed && !busy}
          style={[styles.input, { color: colores.texto, borderColor: colores.borde }]} />
        <Action label="Enviar" primary disabled={!session || closed || Boolean(busy) || !draft.trim()} onPress={send} />
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

/** Boton accesible con dimensiones tactiles estables. */
function Action({ label, onPress, disabled, primary }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  const { colores } = useThemeMobile();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={[styles.button, { backgroundColor: primary ? colores.primario : colores.superficie, borderColor: colores.borde, opacity: disabled ? 0.5 : 1 }]}>
    <Text style={{ color: primary ? '#fff' : colores.texto, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, header: { padding: 16, gap: 12, borderBottomWidth: 1 },
  title: { fontSize: 22, fontWeight: '700' }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  history: { maxHeight: 180, paddingHorizontal: 16 }, historyItem: { paddingVertical: 12 },
  messages: { flex: 1 }, messageContent: { padding: 16, gap: 12 },
  message: { maxWidth: '94%', padding: 14, borderRadius: 8 }, author: { fontSize: 12, fontWeight: '700', marginBottom: 5 },
  messageText: { fontSize: 15, lineHeight: 22 }, summary: { gap: 12, paddingVertical: 16 },
  detail: { paddingVertical: 10, borderBottomWidth: 1, gap: 4 },
  actions: { gap: 10 }, error: { padding: 12, color: '#912b38', backgroundColor: '#fff0f2' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 8, borderTopWidth: 1 },
  input: { flex: 1, minHeight: 48, maxHeight: 130, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 15 },
  button: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  progress: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 }, progressTrack: { height: 5, backgroundColor: '#e0d8ef', borderRadius: 3 },
  progressFill: { height: 5, backgroundColor: '#7950b3', borderRadius: 3 },
});
