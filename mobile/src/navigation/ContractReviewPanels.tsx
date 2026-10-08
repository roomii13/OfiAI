/** @archivo ContractReviewPanels.tsx @descripcion Importes del servidor y evaluaciones verificadas en Expo. */
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ContractCharges } from '../../../shared/billing';
import type { JobReviewState } from '../../../shared/reviews';
import { useThemeMobile } from '../providers/theme';
import { useMobileResource } from '../lib/resources';
import { apiMobile } from '../lib/api';
import { CoordinatorButton } from './CoordinatorUi';

/** La app no recalcula dinero ni presenta un presupuesto como deposito protegido. */
export function MobileContractCharges({ charges }: { charges?: ContractCharges | null }) {
  const { colores } = useThemeMobile();
  /** Formatea el importe persistido en unidades menores. */
  function money(minor: number): string { return (minor / 100).toLocaleString('es-AR') + ' ' + charges!.currency; }
  return <View style={[s.section, { borderColor: colores.borde }]}>
    <Text accessibilityRole="header" style={[s.heading, { color: colores.texto }]}>Importes de la contratacion</Text>
    {charges ? <>
      <Text style={{ color: colores.texto }}>Profesional: {money(charges.professionalAmountMinor)}</Text>
      <Text style={{ color: colores.texto }}>Comision del contratante ({charges.basisPoints / 100}%): {money(charges.feeMinor)}</Text>
      <Text style={[s.heading, { color: colores.texto }]}>Total: {money(charges.contractorTotalMinor)}</Text>
    </> : <Text style={{ color: colores.texto }}>10% adicional al contratante por contratacion efectiva; no se descuenta de los honorarios del profesional.</Text>}
    <Text style={{ color: colores.texto }}>Este presupuesto no es un comprobante de pago. Los cobros se confirman con Mercado Pago.</Text>
    <Text style={{ color: colores.texto }}>La comision de OfiAI se suma al importe del profesional. Los costos del proveedor se detallan por separado antes del pago.</Text>
  </View>;
}

/** Evaluacion tactil, accesible e idempotente, autorizada por la API. */
export function MobileJobReview({ jobId }: { jobId: string }) {
  const { colores } = useThemeMobile();
  const path = '/jobs/' + encodeURIComponent(jobId) + '/review';
  const resource = useMobileResource<JobReviewState>(path);
  const [rating, setRating] = useState(0); const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  /** Un reintento no genera otra resena ni aumenta el promedio dos veces. */
  async function submit(): Promise<void> {
    if (busy || !resource.data?.canReview || !rating || comment.trim().length < 10) return;
    setBusy(true); setMessage('');
    try {
      await apiMobile.post(path, { calificacion: rating, comentario: comment.trim() });
      setMessage('Evaluacion registrada.'); resource.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No pudimos guardar la evaluacion.'); }
    finally { setBusy(false); }
  }
  return <View style={[s.section, { borderColor: colores.borde }]}>
    <Text accessibilityRole="header" style={[s.heading, { color: colores.texto }]}>Evaluacion del trabajo</Text>
    {resource.loading && <ActivityIndicator accessibilityLabel="Consultando evaluacion" />}
    {!!resource.error && <><Text accessibilityRole="alert" style={{ color: colores.texto }}>{resource.error}</Text>
      <CoordinatorButton label="Reintentar evaluacion" icon="refresh" onPress={resource.reload} /></>}
    {resource.data?.review && <>
      <Text style={{ color: colores.texto }}>{resource.data.review.calificacion} / 5. Contratacion verificada.</Text>
      <Text style={{ color: colores.texto }}>{resource.data.review.comentario}</Text>
    </>}
    {resource.data?.canReview && !resource.loading && <>
      <View style={s.stars}>{[1, 2, 3, 4, 5].map(value => <Pressable key={value} accessibilityRole="button"
        accessibilityLabel={value + (value === 1 ? ' estrella' : ' estrellas')}
        accessibilityState={{ selected: rating === value, disabled: busy }} disabled={busy}
        style={s.star} onPress={() => setRating(value)}><Ionicons name={value <= rating ? 'star' : 'star-outline'} size={28} color="#986500" /></Pressable>)}</View>
      <Text style={{ color: colores.texto }}>Tu experiencia</Text>
      <TextInput accessibilityLabel="Tu experiencia" multiline textAlignVertical="top" maxLength={1500}
        editable={!busy} value={comment} onChangeText={setComment} style={[s.input, { color: colores.texto, borderColor: colores.borde }]} />
      <CoordinatorButton label={busy ? 'Guardando...' : 'Publicar evaluacion'} icon="send-outline" primary
        disabled={busy || !rating || comment.trim().length < 10} onPress={() => { void submit(); }} />
    </>}
    {resource.data && !resource.data.review && !resource.data.canReview && <Text style={{ color: colores.texto }}>La evaluacion corresponde al contratante despues de confirmar el trabajo.</Text>}
    {!!message && <Text accessibilityLiveRegion="polite" style={{ color: colores.texto }}>{message}</Text>}
  </View>;
}
const s = StyleSheet.create({
  section: { borderTopWidth: 1, paddingVertical: 20, gap: 12 }, heading: { fontSize: 18, fontWeight: '600' },
  stars: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 }, star: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 110, borderWidth: 1, borderRadius: 6, padding: 12, fontSize: 16 },
  warning: { backgroundColor: '#fff8e4', borderLeftColor: '#986500', borderLeftWidth: 4, padding: 12, gap: 8 },
  warningTitle: { color: '#634300', fontWeight: '600' }, warningText: { color: '#634300' },
});
