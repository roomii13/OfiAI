/**
 * @archivo JobMatchesScreen.tsx
 * @descripcion Matching nativo con filtros locales, perfil publico y seleccion explicita.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuthMobile } from '../context/AuthContext';
import { useThemeMobile } from '../providers/theme';
import { useMatching } from '../lib/matching';
import type { AppTabParamList } from '../types';
import type { ProfessionalMatch } from '../../../shared/matching';
const stages = ['Analizando tu solicitud', 'Buscando profesionales compatibles', 'Comparando experiencia y habilidades', 'Evaluando proximidad', 'Generando recomendaciones'];
const sorts = { recommended: 'Recomendados', score: 'Mayor compatibilidad', near: 'Mas cercanos', rating: 'Mejor valoracion', experience: 'Mas experiencia' };
const urgency: Record<string, string> = { low: 'Baja', medium: 'Normal', normal: 'Normal', high: 'Alta', emergency: 'Emergencia' };

/** Precio publicado, nunca una cotizacion estimada por IA. */
function priceLabel(price: number | null, currency: string | null): string {
  return price === null ? 'A consultar' : price.toLocaleString('es-AR') + ' ' + (currency ?? 'Moneda por confirmar');
}

/** Restringe la experiencia a empresas y a la ruta del Job seleccionado. */
export function JobMatchesScreen() {
  const { usuario } = useAuthMobile();
  const route = useRoute<RouteProp<AppTabParamList, 'JobMatches'>>();
  if (usuario?.rol !== 'empresa') return <Text>Esta funcion esta disponible para empresas.</Text>;
  if (!route.params?.jobId) return <Text>Selecciona un trabajo para ver sus candidatos.</Text>;
  return <Matches key={usuario.uid + ':' + route.params.jobId} jobId={route.params.jobId} />;
}

/** Vista movil: resumen plegable, controles tactiles y resultados reales. */
function Matches({ jobId }: { jobId: string }) {
  const focused = useIsFocused();
  const { colores, modo } = useThemeMobile();
  const nav = useNavigation<BottomTabNavigationProp<AppTabParamList>>();
  const matching = useMatching(jobId);
  const result = matching.result;
  const [sheet, setSheet] = useState<'filters' | 'sort' | null>(null);
  const [profile, setProfile] = useState<ProfessionalMatch | null>(null);
  const [summary, setSummary] = useState(false);
  const [sort, setSort] = useState<keyof typeof sorts>('recommended');
  const [distance, setDistance] = useState('');
  const [experience, setExperience] = useState('');
  const [rating, setRating] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('');
  const [category, setCategory] = useState('');
  const [available, setAvailable] = useState(false);
  useEffect(() => { if (!focused) { setProfile(null); setSheet(null); } }, [focused]);
  const categories = [...new Set(result?.matches.flatMap(row => row.professional.categories) ?? [])];
  const currencies = [...new Set(result?.matches.map(row => row.professional.currency).filter((value): value is string => Boolean(value)) ?? [])];
  const candidates = useMemo(() => (result?.matches ?? []).filter(row => {
    const pro = row.professional;
    return (!category || pro.categories.includes(category)) && (!distance || row.distanceKm !== null && row.distanceKm <= Number(distance))
      && (!experience || pro.experienceYears !== null && pro.experienceYears >= Number(experience))
      && (!rating || pro.rating !== null && pro.rating >= Number(rating)) && (!available || pro.available === true)
      && (!price || pro.minimumPrice !== null && pro.minimumPrice <= Number(price) && pro.currency === currency);
  }).sort((a, b) => {
    if (sort === 'near') return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || b.matchScore - a.matchScore;
    if (sort === 'rating') return (b.professional.rating ?? -1) - (a.professional.rating ?? -1) || b.matchScore - a.matchScore;
    if (sort === 'experience') return (b.professional.experienceYears ?? -1) - (a.professional.experienceYears ?? -1) || b.matchScore - a.matchScore;
    return (sort === 'recommended' ? Number(b.recommended) - Number(a.recommended) : 0) || b.matchScore - a.matchScore;
  }), [result, category, distance, experience, rating, available, price, currency, sort]);
  /** Limpia filtros sin consultar Gemini. */
  function clear(): void { setDistance(''); setExperience(''); setRating(''); setPrice(''); setCurrency(''); setCategory(''); setAvailable(false); }
  const job = result?.job;
  const selectedProfile = profile && (result?.matches.find(row => row.professionalId === profile.professionalId) ?? profile);
  return <SafeAreaView edges={['top', 'left', 'right']} style={[styles.root, { backgroundColor: colores.fondo }]}>
    <View style={[styles.header, { borderColor: colores.borde }]}>
      <View style={styles.row}><Action label="Mis trabajos" onPress={() => nav.navigate('Trabajos')} /><Text style={{ color: colores.primario, fontWeight: '700' }}>OfiAI · Matching</Text></View>
      <Text accessibilityRole="header" style={[styles.title, { color: colores.texto }]}>Profesionales recomendados</Text>
    </View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {job && <View style={[styles.summary, { backgroundColor: modo === 'oscuro' ? colores.superficie : '#e9f4fa' }]}>
        <Text style={[styles.subtitle, { color: colores.texto }]}>{job.title}</Text>
        <Text style={{ color: colores.textoSuave }}>{job.category} · {job.location.city ?? 'Ubicacion por confirmar'}</Text>
        <Action label={summary ? 'Ocultar solicitud' : 'Ver solicitud'} onPress={() => setSummary(value => !value)} />
        {summary && <View style={styles.details}>
          <Detail label="Ubicacion" value={[job.location.city, job.location.province, job.location.country].filter(Boolean).join(', ')} />
          <Detail label="Urgencia" value={urgency[job.urgency ?? ''] ?? 'Por confirmar'} />
          <Detail label="Fecha" value={job.preferredDate ?? 'A coordinar'} />
          <Detail label="Presupuesto" value={job.budget.min === null && job.budget.max === null ? 'A cotizar' : priceLabel(job.budget.min, job.budget.currency) + ' / ' + priceLabel(job.budget.max, job.budget.currency)} />
          <Detail label="Detalle" value={job.description} />
        </View>}
      </View>}
      {matching.error ? <View style={styles.error}><Text accessibilityRole="alert" style={{ color: '#872938' }}>{matching.error}</Text><Action label="Reintentar" disabled={matching.busy} onPress={matching.reload} /></View> : null}
      {matching.busy ? <View style={styles.loading} accessibilityLiveRegion="polite"><ActivityIndicator color={colores.primario} />
        <Text style={[styles.subtitle, { color: colores.texto }]}>OfiAI esta buscando profesionales...</Text>
        {stages.map((stage, index) => <Text key={stage} style={{ color: colores.textoSuave }}>{(result?.completedStages ?? 0) > index ? 'Listo: ' : (index + 1) + '. '}{stage}</Text>)}
        {matching.slow && <Text style={{ color: colores.textoSuave }}>Esto esta tomando un poco mas de tiempo. Seguimos trabajando...</Text>}
      </View> : result && ['completed', 'fallback'].includes(result.status) ? <>
        <Text style={{ color: colores.textoSuave }}>{result.message}</Text>
        <Action label="Ver estimacion de precio" onPress={() => nav.navigate('JobPricing', { jobId })} />
        <Action label="Coordinar trabajo" onPress={() => nav.navigate('JobCoordinator', { jobId })} />
        <Text style={{ color: colores.primario, fontSize: 12 }}>{result.semanticMatchingUsed ? 'Compatibilidad + analisis semantico' : 'Criterios de compatibilidad'} · {result.totalCandidates} compatibles</Text>
        {result.searchLimited && <Text style={{ color: colores.textoSuave }}>Busqueda limitada a {result.scannedCandidates} perfiles del catalogo.</Text>}
        {result.selectedProfessionalId && <View style={[styles.summary, { backgroundColor: modo === 'oscuro' ? colores.superficie : '#e7f6ee' }]}><Text style={[styles.subtitle, { color: colores.texto }]}>Seleccion guardada</Text><Text style={{ color: colores.texto }}>Todavia no se realizo una contratacion.</Text></View>}
        {result.matches.length > 0 ? <>
          <View style={styles.row}><Action label="Filtrar candidatos" onPress={() => setSheet('filters')} /><Action label={'Ordenar: ' + sorts[sort]} onPress={() => setSheet('sort')} /></View>
          <Text style={{ color: colores.texto }}>{candidates.length} candidatos</Text>
          {candidates.map(match => <Candidate key={match.professionalId} match={match} disabled={Boolean(matching.action)}
            onProfile={() => { void matching.profile(match.professionalId).then(value => { if (value) setProfile(value); }); }}
            onSelect={() => { void matching.select(match.professionalId); }} />)}
          {!candidates.length && <><Text style={{ color: colores.texto }}>No hay candidatos con estos filtros.</Text><Action label="Limpiar filtros" onPress={clear} /></>}
        </> : <View style={styles.loading}><Text style={[styles.subtitle, { color: colores.texto }]}>Todavia no encontramos profesionales que cumplan todos los requisitos.</Text><Text style={{ color: colores.textoSuave }}>Podemos ampliar la busqueda.</Text><Action label="Ampliar radio · Proximamente" disabled onPress={() => setSummary(true)} /></View>}
        <Action label="Actualizar recomendaciones" onPress={matching.reload} disabled={Boolean(matching.action)} />
      </> : null}
    </ScrollView>
    <Sheet visible={sheet !== null} title={sheet === 'sort' ? 'Ordenar candidatos' : 'Filtrar candidatos'} onClose={() => setSheet(null)}>
      {sheet === 'sort' ? Object.entries(sorts).map(([key, label]) => <Choice key={key} label={label} selected={sort === key} onPress={() => { setSort(key as keyof typeof sorts); setSheet(null); }} />) : <>
        <Numeric label="Distancia maxima (km)" value={distance} onChange={setDistance} />
        <Numeric label="Experiencia minima (anos)" value={experience} onChange={setExperience} />
        <Numeric label="Valoracion minima (0 a 5)" value={rating} onChange={setRating} />
        <Text style={[styles.subtitle, { color: colores.texto }]}>Categoria</Text>
        {['', ...categories].map(value => <Choice key={value} label={value || 'Todas'} selected={category === value} onPress={() => setCategory(value)} />)}
        <Text style={[styles.subtitle, { color: colores.texto }]}>Moneda</Text>
        {['', ...currencies].map(value => <Choice key={value} label={value || 'Sin filtro de precio'} selected={currency === value} onPress={() => { setCurrency(value); setPrice(''); }} />)}
        {currency ? <Numeric label="Precio minimo del perfil hasta" value={price} onChange={setPrice} /> : null}
        <View style={styles.row}><Text style={{ color: colores.texto, flex: 1 }}>Disponibilidad confirmada</Text><Switch accessibilityLabel="Disponibilidad confirmada" value={available} onValueChange={setAvailable} /></View>
        <Action label="Limpiar filtros" onPress={clear} /><Action label="Ver resultados" primary onPress={() => setSheet(null)} />
      </>}
    </Sheet>
    <Sheet visible={Boolean(selectedProfile)} title="Perfil profesional" onClose={() => setProfile(null)}>
      {matching.error ? <Text accessibilityRole="alert" style={styles.error}>{matching.error}</Text> : null}
      {selectedProfile && <><Candidate match={selectedProfile} profile disabled={Boolean(matching.action)} onSelect={() => { void matching.select(selectedProfile.professionalId); }} onProfile={() => setProfile(null)} /></>}
    </Sheet>
  </SafeAreaView>;
}

/** Perfil resumido o completo, con estados desconocidos explicitos. */
function Candidate({ match, disabled, profile, onProfile, onSelect }: { match: ProfessionalMatch; disabled: boolean; profile?: boolean; onProfile: () => void; onSelect: () => void }) {
  const { colores, modo } = useThemeMobile();
  const [imageFailed, setImageFailed] = useState(false);
  const [concerns, setConcerns] = useState(false);
  const pro = match.professional;
  const container: ViewStyle = profile ? { gap: 12 } : { ...styles.card, backgroundColor: colores.superficie, borderColor: match.state === 'selected' ? '#388d74' : colores.borde };
  return <View style={container}>
    <View style={styles.row}>
      {pro.profileImage && !imageFailed ? <Image source={{ uri: pro.profileImage }} style={styles.avatar} onError={() => setImageFailed(true)} />
        : <View style={[styles.avatar, styles.initials]}><Text style={{ color: '#665285', fontSize: 19, fontWeight: '700' }}>{pro.firstName[0]}{pro.lastName[0]}</Text></View>}
      <View style={{ flex: 1 }}><Text style={[styles.subtitle, { color: colores.texto }]}>{pro.firstName} {pro.lastName}</Text><Text style={{ color: colores.textoSuave }}>{pro.categories.join(', ')}</Text></View>
    </View>
    <View style={[styles.score, { backgroundColor: modo === 'oscuro' ? colores.fondo : '#eaf7f0' }]}><Text style={{ color: colores.texto, fontWeight: '700', fontSize: 20 }}>{Math.round(match.matchScore)}% de compatibilidad</Text><Text style={{ color: colores.textoSuave, fontSize: 12 }}>Recomendacion de OfiAI</Text></View>
    <Text style={{ color: colores.texto }}>{pro.rating === null ? 'Sin valoraciones' : pro.rating.toFixed(1) + ' / 5'} · {pro.experienceYears === null ? 'Experiencia no informada' : pro.experienceYears + ' anos de experiencia'}</Text>
    <Text style={{ color: colores.textoSuave }}>{pro.location.city ?? 'Ciudad no informada'}{match.distanceKm === null ? '' : ' · ' + match.distanceKm.toFixed(1) + ' km'}</Text>
    <Text style={{ color: colores.textoSuave }}>{pro.completedJobs === null ? 'Historial no informado' : pro.completedJobs + ' trabajos completados'} · {pro.available === true ? 'Disponible' : pro.available === false ? 'No disponible' : 'Disponibilidad por confirmar'}</Text>
    <Text style={[styles.subtitle, { color: colores.texto }]}>Por que OfiAI lo recomienda</Text><Text style={{ color: colores.texto }}>{match.reason}</Text>
    {match.strengths.map(item => <Text key={item} style={{ color: colores.textoSuave }}>+ {item}</Text>)}
    {match.concerns.length > 0 && <><Action label={concerns ? 'Ocultar aspectos por confirmar' : 'Aspectos por confirmar'} onPress={() => setConcerns(value => !value)} />{concerns && match.concerns.map(item => <Text key={item} style={{ color: colores.textoSuave }}>{item}</Text>)}</>}
    {profile && <View style={styles.details}>
      <Detail label="Descripcion" value={pro.description ?? 'No informada'} />
      <Detail label="Habilidades" value={pro.skills.join(', ') || 'No informadas'} />
      <Detail label="Ubicacion aproximada" value={[pro.location.city, pro.location.province, pro.location.country].filter(Boolean).join(', ')} />
      <Detail label="Dias disponibles" value={pro.availabilityDays.join(', ') || 'Por confirmar'} />
      <Detail label="Verificacion" value={pro.verified ? 'Verificado' : 'Sin verificar'} />
      <Detail label="Precio minimo publicado" value={priceLabel(pro.minimumPrice, pro.currency)} />
      <Detail label="Tarifa por hora" value={priceLabel(pro.hourlyRate, pro.currency)} />
    </View>}
    {!profile && <Action label="Ver perfil" onPress={onProfile} disabled={disabled} />}
    <Action label={match.state === 'selected' ? 'Seleccionado' : 'Seleccionar profesional'} onPress={onSelect} disabled={disabled || match.state === 'selected'} primary />
  </View>;
}

/** Boton con area tactil minima y estado accesible. */
function Action({ label, onPress, disabled = false, primary = false }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  const { colores } = useThemeMobile();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[styles.button, { borderColor: colores.borde, backgroundColor: primary ? colores.primario : colores.superficie, opacity: disabled ? 0.55 : 1 }]}>
    <Text style={{ color: primary ? '#fff' : colores.texto, textAlign: 'center', fontWeight: '600' }}>{label}</Text>
  </Pressable>;
}
/** Opcion de menu con estado radio, sin nuevas dependencias. */
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colores } = useThemeMobile();
  return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={[styles.choice, { borderColor: colores.borde }]}>
    <View style={[styles.radio, { borderColor: colores.primario, backgroundColor: selected ? colores.primario : 'transparent' }]} /><Text style={{ color: colores.texto, flex: 1 }}>{label}</Text>
  </Pressable>;
}
/** Campo numerico que rechaza signos negativos y texto arbitrario. */
function Numeric({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const { colores } = useThemeMobile();
  return <View style={{ gap: 8 }}><Text style={{ color: colores.texto }}>{label}</Text><TextInput accessibilityLabel={label} keyboardType="decimal-pad" value={value} maxLength={12}
    onChangeText={text => { const normalized = text.replace(',', '.'); if (/^\d*(\.\d*)?$/.test(normalized)) onChange(normalized); }}
    style={[styles.input, { color: colores.texto, borderColor: colores.borde }]} /></View>;
}
/** Ventana nativa que cierra con Back y conserva el estado de filtros. */
function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const { colores } = useThemeMobile();
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <SafeAreaView style={[styles.root, { backgroundColor: colores.fondo }]}><View style={[styles.header, { borderColor: colores.borde }]}><Text style={[styles.title, { color: colores.texto }]}>{title}</Text><Action label="Cerrar" onPress={onClose} /></View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    </SafeAreaView>
  </Modal>;
}
/** Etiqueta y valor del resumen sin exponer contactos ni coordenadas exactas. */
function Detail({ label, value }: { label: string; value: string }) {
  const { colores } = useThemeMobile();
  return <View style={{ gap: 4 }}><Text style={{ color: colores.textoSuave, fontSize: 12 }}>{label}</Text><Text style={{ color: colores.texto }}>{value || 'No informado'}</Text></View>;
}
const styles = StyleSheet.create({
  root: { flex: 1 }, header: { padding: 16, gap: 12, borderBottomWidth: 1 }, title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 16, fontWeight: '700' }, content: { padding: 16, paddingBottom: 40, gap: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }, summary: { padding: 16, gap: 10 },
  details: { gap: 16, paddingVertical: 12 }, card: { padding: 16, borderRadius: 8, borderWidth: 1, gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 }, initials: { backgroundColor: '#eee9f9', alignItems: 'center', justifyContent: 'center' },
  score: { paddingVertical: 12, paddingHorizontal: 12, gap: 4 }, button: { minHeight: 46, borderRadius: 8, borderWidth: 1, justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 12 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, borderBottomWidth: 1, paddingVertical: 12 },
  radio: { width: 18, height: 18, borderWidth: 2, borderRadius: 9 }, input: { borderWidth: 1, borderRadius: 6, minHeight: 48, padding: 12, fontSize: 16 },
  loading: { paddingVertical: 20, gap: 14 }, error: { padding: 12, backgroundColor: '#fff0f1', gap: 12 },
});
