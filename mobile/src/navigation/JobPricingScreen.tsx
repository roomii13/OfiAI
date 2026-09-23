/** @archivo JobPricingScreen.tsx @descripcion Pricing nativo: rango, evidencia y presupuestos con formularios tactiles. */
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuthMobile } from '../context/AuthContext';
import { useThemeMobile } from '../providers/theme';
import { usePricing } from '../lib/pricing';
import type { AppTabParamList } from '../types';
import type { PricingInputs, PricingQuote } from '../../../shared/pricing';
const empty: PricingInputs = { currency: 'ARS', scope: '', unit: 'hour', quantity: 1, materials: 'unknown', materialsCost: null, taxes: 'unknown', requiredExperienceYears: null };
const units = { hour: 'Horas', m2: 'm2', unit: 'Unidades', job: 'Trabajo completo' };
const covers = { included: 'Incluidos', excluded: 'Excluidos', unknown: 'Por confirmar' };
/** Identificador de reintento; no es token de seguridad ni autoriza acceso. */
function quoteId(): string { return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2); }
/** Mantiene moneda explicita sin conversiones. */
function money(n: number, currency: string): string { return n.toLocaleString('es-AR', { maximumFractionDigits: 2 }) + ' ' + currency; }
/** Aislamiento de estado por cuenta y solicitud. */
export function JobPricingScreen() {
  const { usuario } = useAuthMobile(); const route = useRoute<RouteProp<AppTabParamList, 'JobPricing'>>();
  if (usuario?.rol !== 'empresa') return <Text>Esta funcion esta disponible para empresas.</Text>;
  if (!route.params?.jobId) return <Text>Selecciona un trabajo.</Text>;
  return <Pricing key={usuario.uid + route.params.jobId} jobId={route.params.jobId} />;
}
/** Resumen escaneable con edicion en una hoja que respeta teclado y Back. */
function Pricing({ jobId }: { jobId: string }) {
  const { colores, modo } = useThemeMobile(); const focused = useIsFocused();
  const nav = useNavigation<BottomTabNavigationProp<AppTabParamList>>();
  const pricing = usePricing(jobId); const view = pricing.view; const result = view?.result;
  const [sheet, setSheet] = useState<'inputs' | 'quote' | null>(null); const [terms, setTerms] = useState<PricingInputs>(empty);
  const [id, setId] = useState(quoteId); const [label, setLabel] = useState(''); const [amount, setAmount] = useState(''); const [until, setUntil] = useState('');
  const [details, setDetails] = useState(false); const [history, setHistory] = useState(false);
  useEffect(() => { if (!focused) setSheet(null); }, [focused]);
  /** Inicializa desde la revision vigente; los cambios aun no se guardan. */
  function open(kind: 'inputs' | 'quote'): void {
    setTerms(view?.inputs ?? { ...empty, currency: view?.job.budget.currency ?? 'ARS', scope: view?.job.estimatedScope ?? '' });
    setSheet(kind);
  }
  /** Conserva ID ante timeout; solo reinicia al confirmar persistencia. */
  async function save(): Promise<void> {
    if (sheet === 'inputs') { if (await pricing.saveInputs(terms)) setSheet(null); return; }
    const { materialsCost: _cost, requiredExperienceYears: _years, ...rest } = terms;
    const quote: PricingQuote = { ...rest, id, label, amount: Number(amount), validUntil: until };
    if (await pricing.saveQuote(quote)) { setSheet(null); setLabel(''); setAmount(''); setUntil(''); setId(quoteId()); }
  }
  return <SafeAreaView style={[s.root, { backgroundColor: colores.fondo }]}>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Button label="Profesionales" onPress={() => nav.navigate('JobMatches', { jobId })} />
      <Text style={[s.title, { color: colores.texto }]} accessibilityRole="header">Estimacion del trabajo</Text>
      <Text style={{ color: colores.texto }}>{view?.job.title ?? 'Cargando solicitud'}</Text>
      <Text style={{ color: colores.textoSuave }}>{view?.job.category} · {view?.job.location.city ?? ''}</Text>
      {pricing.error ? <Text accessibilityRole="alert" style={s.error}>{pricing.error}</Text> : null}
      {pricing.busy && <View accessibilityLiveRegion="polite"><ActivityIndicator color={colores.primario} /><Text style={{ color: colores.texto }}>OfiAI esta analizando el alcance y las referencias...</Text></View>}
      {view && <>
        <View style={[s.band, { backgroundColor: modo === 'oscuro' ? colores.superficie : '#e9f5f9' }]}>
          <Text style={{ color: colores.textoSuave }}>RANGO ORIENTATIVO</Text>
          <Text style={[s.price, { color: colores.texto }]}>{result?.range ? money(result.range.min, result.currency) + ' a ' + money(result.range.max, result.currency) : 'Faltan referencias comparables'}</Text>
          <Text style={{ color: colores.texto }}>Confianza {result?.confidence ?? 0}% · {result?.evidenceCount ?? 0} referencias</Text>
          <Text style={{ color: colores.textoSuave }}>Estimacion, no precio final. No implica contratacion ni cobro.</Text>
        </View>
        {result?.missingInformation.map(text => <Text key={text} style={{ color: colores.texto }}>{text}</Text>)}
        <Button label="Editar alcance y condiciones" onPress={() => open('inputs')} disabled={pricing.busy} />
        <Button label={details ? 'Ocultar analisis' : 'Ver factores y referencias'} onPress={() => setDetails(v => !v)} />
        {details && result && <View style={s.section}>
          {[...result.factors, ...result.warnings, ...result.assumptions].map((text, i) => <Text key={i} style={{ color: colores.texto }}>{text}</Text>)}
          {result.analysis && <Text style={{ color: colores.texto }}>{result.analysis}</Text>}
          {result.evidence.map(e => <Text key={e.id} style={{ color: colores.textoSuave }}>{e.source === 'rate' ? 'Tarifa horaria' : e.source === 'history' ? 'Historico propio' : 'Presupuesto declarado'}: {money(e.amount, e.currency)} / {e.quantity} {e.unit}</Text>)}
        </View>}
        <Text style={[s.subtitle, { color: colores.texto }]}>Presupuestos recibidos</Text>
        {(result?.comparisons ?? view.quotes.map(q => ({ ...q, flag: 'unverified', comparable: false, explanation: 'Pendiente de recalculo.' }))).map(q => <View key={q.id} style={[s.quote, { borderColor: colores.borde, backgroundColor: colores.superficie }]}>
          <Text style={[s.subtitle, { color: colores.texto }]}>{q.label}</Text><Text style={{ color: colores.texto }}>{money(q.amount, q.currency)}</Text>
          <Text style={{ color: colores.texto }}>{q.flag === 'high' ? 'Importe alto atipico' : q.flag === 'low' ? 'Importe bajo atipico' : q.comparable ? 'Comparable' : 'No comparable'}</Text>
          <Text style={{ color: colores.textoSuave }}>{q.explanation}</Text>
        </View>)}
        {view.quotes.length === 0 && !result?.comparisons.length && <Text style={{ color: colores.textoSuave }}>No hay presupuestos registrados.</Text>}
        <Button label="Agregar presupuesto recibido" onPress={() => open('quote')} disabled={pricing.busy} />
        <Button label="Actualizar estimacion" onPress={() => { void pricing.reload(); }} disabled={pricing.busy} />
        <Button label={history ? 'Ocultar historial' : 'Historial de estimaciones'} onPress={() => setHistory(v => !v)} />
        {history && view.history.map(item => <Text key={item.id} style={{ color: colores.texto }}>{new Date(item.generatedAt).toLocaleString('es-AR')}: {item.range ? money(item.range.min, item.currency) + ' a ' + money(item.range.max, item.currency) : 'Informacion insuficiente'} · {item.confidence}%</Text>)}
        <Text style={{ color: colores.texto }}>{view.nextStep === 'coordinator_pending' ? 'Preparado para Coordinacion. Aun no hay contratacion.' : view.nextStep === 'professional_selection' ? 'Siguiente: seleccionar profesional.' : 'Completa la estimacion para continuar.'}</Text>
      </>}
    </ScrollView>
    <Modal visible={sheet !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!pricing.busy) setSheet(null); }}>
      <SafeAreaView style={[s.root, { backgroundColor: colores.fondo }]}><KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Button label="Cerrar" onPress={() => setSheet(null)} disabled={pricing.busy} />
          <Text style={[s.title, { color: colores.texto }]}>{sheet === 'quote' ? 'Presupuesto recibido' : 'Alcance y condiciones'}</Text>
          {pricing.error ? <Text accessibilityRole="alert" style={s.error}>{pricing.error}</Text> : null}
          {sheet === 'quote' && <><Field label="Referencia del presupuesto" value={label} onChange={setLabel} maxLength={100} /><Field label="Importe total" value={amount} onChange={setAmount} numeric /><Field label="Valido hasta (AAAA-MM-DD)" value={until} onChange={setUntil} maxLength={10} /><Text style={{ color: colores.textoSuave }}>Registro declarado por tu empresa; no contacta al profesional.</Text></>}
          <Field label="Alcance comparable" value={terms.scope} onChange={scope => setTerms({ ...terms, scope })} multiline maxLength={400} />
          <Field label="Moneda" value={terms.currency} onChange={currency => setTerms({ ...terms, currency: currency.toUpperCase() })} maxLength={3} />
          <Choices label="Unidad" value={terms.unit} options={units} onChange={unit => setTerms({ ...terms, unit: unit as PricingInputs['unit'], quantity: unit === 'job' ? 1 : terms.quantity })} />
          {terms.unit !== 'job' && <Field label="Cantidad" value={String(terms.quantity)} numeric onChange={value => setTerms({ ...terms, quantity: Number(value) })} />}
          <Choices label="Materiales" value={terms.materials} options={covers} onChange={materials => setTerms({ ...terms, materials: materials as PricingInputs['materials'], materialsCost: null })} />
          <Choices label="Impuestos" value={terms.taxes} options={covers} onChange={taxes => setTerms({ ...terms, taxes: taxes as PricingInputs['taxes'] })} />
          {sheet === 'inputs' && <>{terms.materials === 'excluded' && <Field label="Costo conocido de materiales" value={terms.materialsCost === null ? '' : String(terms.materialsCost)} numeric onChange={v => setTerms({ ...terms, materialsCost: v === '' ? null : Number(v) })} />}
            <Field label="Experiencia requerida (anos)" value={terms.requiredExperienceYears === null ? '' : String(terms.requiredExperienceYears)} numeric onChange={v => setTerms({ ...terms, requiredExperienceYears: v === '' ? null : Number(v) })} /></>}
          <Button label={sheet === 'quote' ? 'Registrar presupuesto' : 'Guardar y estimar'} primary disabled={pricing.busy} onPress={() => { void save(); }} />
          {pricing.busy && <ActivityIndicator color={colores.primario} />}
        </ScrollView></KeyboardAvoidingView></SafeAreaView>
    </Modal>
  </SafeAreaView>;
}
/** Comando tactil accesible con estado deshabilitado. */
function Button({ label, onPress, disabled = false, primary = false }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  const { colores } = useThemeMobile();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[s.button, { backgroundColor: primary ? colores.primario : colores.superficie, borderColor: colores.borde, opacity: disabled ? .5 : 1 }]}><Text style={{ color: primary ? '#fff' : colores.texto, textAlign: 'center', fontWeight: '600' }}>{label}</Text></Pressable>;
}
/** Campo con etiqueta persistente y teclado adaptado. */
function Field({ label, value, onChange, numeric = false, multiline = false, maxLength = 14 }: { label: string; value: string; onChange: (v: string) => void; numeric?: boolean; multiline?: boolean; maxLength?: number }) {
  const { colores } = useThemeMobile();
  return <View style={s.field}><Text style={{ color: colores.texto }}>{label}</Text><TextInput accessibilityLabel={label} value={value} maxLength={maxLength} multiline={multiline}
    keyboardType={numeric ? 'decimal-pad' : 'default'} onChangeText={text => onChange(numeric ? text.replace(',', '.') : text)}
    style={[s.input, { borderColor: colores.borde, color: colores.texto, minHeight: multiline ? 90 : 48 }]} /></View>;
}
/** Selector de opciones radio que se adapta al ancho del telefono. */
function Choices({ label, value, options, onChange }: { label: string; value: string; options: Record<string, string>; onChange: (v: string) => void }) {
  const { colores } = useThemeMobile();
  return <View style={s.field}><Text style={{ color: colores.texto }}>{label}</Text>{Object.entries(options).map(([key, title]) => <Pressable key={key} accessibilityRole="radio" accessibilityLabel={label + ': ' + title} accessibilityState={{ selected: key === value }} onPress={() => onChange(key)} style={[s.choice, { borderColor: colores.borde }]}><View style={[s.radio, { borderColor: colores.primario, backgroundColor: value === key ? colores.primario : 'transparent' }]} /><Text style={{ color: colores.texto }}>{title}</Text></Pressable>)}</View>;
}
const s = StyleSheet.create({
  root: { flex: 1 }, content: { padding: 16, paddingBottom: 40, gap: 16 }, title: { fontSize: 23, fontWeight: '700' },
  subtitle: { fontSize: 17, fontWeight: '600' }, price: { fontSize: 24, fontWeight: '700' }, band: { padding: 18, gap: 12 },
  section: { gap: 14 }, quote: { padding: 16, gap: 10, borderWidth: 1, borderRadius: 8 }, field: { gap: 8 },
  input: { borderWidth: 1, borderRadius: 6, padding: 12, fontSize: 16 }, button: { minHeight: 48, padding: 12, borderWidth: 1, borderRadius: 6, justifyContent: 'center' },
  error: { backgroundColor: '#fff0f1', color: '#862e3a', padding: 14 }, choice: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1 },
  radio: { width: 18, height: 18, borderWidth: 2, borderRadius: 9 },
});
