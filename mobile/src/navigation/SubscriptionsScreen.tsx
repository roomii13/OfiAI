/** @archivo SubscriptionsScreen.tsx @descripcion Planes, consumo y pagos reales; compras nativas pendientes de habilitacion. */
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthMobile } from '../context/AuthContext';
import { useThemeMobile } from '../providers/theme';
import { metricLabel, useMobileResource } from '../lib/resources';
import { apiMobile } from '../lib/api';
import type { BillingOverview, CommercialPlan } from '../../../shared/billing';
import type { SubscriptionData } from '../../../shared/contracts';

/** Pantalla comercial nativa: no reemplaza Play Billing o StoreKit con un checkout externo. */
export function SubscriptionsScreen() {
  const { usuario } = useAuthMobile(); const { colores } = useThemeMobile();
  const allowed = usuario?.rol === 'empresa' || usuario?.rol === 'profesional';
  const personal = usuario?.tipoCuenta === 'particular';
  const freeAccount = personal || usuario?.rol === 'profesional';
  const catalog = useMobileResource<CommercialPlan[]>(allowed ? '/subscriptions/plans?audience=' + (personal ? 'particular' : usuario?.rol) : null);
  const billing = useMobileResource<BillingOverview>(allowed ? '/subscriptions/billing' : null);
  const current = useMobileResource<SubscriptionData | null>(allowed ? '/subscriptions/me' : null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  /** Recarga datos sin otorgar acceso por eventos de interfaz. */
  function refresh(): void { catalog.reload(); billing.reload(); current.reload(); }
  /** Confirma la baja de futuros debitos; no solicita devolucion del periodo vigente. */
  function requestCancellation(id: string): void {
    Alert.alert('Cancelar renovacion', 'Conservas el periodo pagado. No se solicita un reembolso.', [
      { text: 'Volver', style: 'cancel' },
      { text: 'Cancelar renovacion', style: 'destructive', onPress: () => { void cancel(id); } },
    ]);
  }
  /** Cancela exclusivamente el contrato propio y refresca despues de respuesta confirmada. */
  async function cancel(id: string): Promise<void> {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      await apiMobile.post('/subscriptions/' + id + '/cancel', { cancelarAlFinalDelPeriodo: true });
      setMessage('Renovacion cancelada. Conservas el periodo pagado.'); refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo cancelar la renovacion.'); }
    finally { setBusy(false); }
  }
  const error = catalog.error || billing.error || current.error;
  return <SafeAreaView style={[styles.root, { backgroundColor: colores.fondo }]}>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={catalog.loading || billing.loading} onRefresh={refresh} />}>
      <Text accessibilityRole="header" style={[styles.title, { color: colores.texto }]}>{freeAccount ? 'Cuenta gratuita' : 'Mi suscripcion'}</Text>
      {freeAccount && <Text style={{ color: colores.texto }}>Gratis para siempre. {personal
        ? 'La comision del 10% se suma al contratante por contratacion efectiva.'
        : 'OfiAI no descuenta su comision de los honorarios del profesional.'}</Text>}
      {!allowed && <Text style={{ color: colores.texto }}>La facturacion global se consulta desde Administracion web.</Text>}
      {allowed && <>
        {(billing.loading || current.loading) && <ActivityIndicator accessibilityLabel="Cargando facturacion" color={colores.primario} />}
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <View style={[styles.band, { borderColor: colores.borde }]}>
          <Text style={[styles.subtitle, { color: colores.texto }]}>{billing.data
            ? catalog.data?.find(plan => plan.id === billing.data?.entitlements.plan)?.nombre ?? billing.data.entitlements.plan
            : billing.loading ? 'Cargando plan...' : 'Plan no disponible'}</Text>
          {current.data && <Text style={{ color: colores.texto }}>{current.data.estado}. Renovacion automatica: {current.data.renovacionAutomatica ? 'si' : 'no'}.</Text>}
          {current.data?.fechaVencimiento && current.data.plan !== 'gratuito' && current.data.estado !== 'pendiente_pago' && <Text style={{ color: colores.texto }}>
            Periodo hasta {new Date(current.data.fechaVencimiento).toLocaleDateString()}.</Text>}
          {current.data?.pendingPlan && <Text style={{ color: colores.texto }}>Cambio pendiente: {current.data.pendingPlan.plan}.</Text>}
          {current.data?.renovacionAutomatica && current.data.plan !== 'gratuito' && <Pressable accessibilityRole="button"
            disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => requestCancellation(current.data!.id)}
            style={[styles.button, { borderColor: colores.borde }]}>
            <Ionicons name="close-circle-outline" size={20} color={colores.texto} /><Text style={{ color: colores.texto }}>Cancelar renovacion</Text>
          </Pressable>}
        </View>
        {billing.data?.pendingCheckout && <View style={[styles.band, { borderColor: colores.borde }]}>
          <Text style={{ color: colores.texto }}>Checkout pendiente: {billing.data.pendingCheckout.plan}</Text>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => requestCancellation(billing.data!.pendingCheckout!.id)}
            style={[styles.button, { borderColor: colores.borde }]}><Text style={{ color: colores.texto }}>Cancelar checkout pendiente</Text></Pressable>
        </View>}
        {billing.data && <View style={[styles.band, { borderColor: colores.borde }]}>
          <Text style={[styles.subtitle, { color: colores.texto }]}>Consumo {billing.data.entitlements.period} (UTC)</Text>
          {(['trabajosPublicados', 'propuestasEnviadas'] as const).filter(key => billing.data!.entitlements.limits[key] !== 0).map(key =>
            <Text key={key} style={{ color: colores.texto }}>{metricLabel(key)}: {billing.data!.entitlements.used[key] ?? 0} / {
              billing.data!.entitlements.limits[key] === -1 ? 'Sin limite' : billing.data!.entitlements.limits[key]}</Text>)}
        </View>}
        <Text style={[styles.subtitle, { color: colores.texto }]}>{freeAccount ? 'Tu cuenta' : 'Planes mensuales'}</Text>
        {catalog.data?.map((plan, index) => <View key={plan.id} style={[styles.plan, { backgroundColor: ['#e9f5fc', '#edf7f0', '#f2edfa', '#fff1f2'][index % 4] }]}>
          <Text style={styles.planName}>{plan.nombre}</Text>
          <Text style={styles.price}>{freeAccount ? 'Gratis para siempre' : 'US$ ' + plan.priceUsd + ' /mes'}</Text>
          {plan.priceUsd > 0 && plan.precioMensual != null && <Text style={styles.planText}>{plan.moneda} {plan.precioMensual.toLocaleString()} /mes en la web</Text>}
          {plan.exchangeRate && <Text style={styles.planText}>1 USD = {plan.exchangeRate.rate.toLocaleString()} ARS.
            {' '}{plan.exchangeRate.source === 'mercadopago' ? 'Mercado Pago' : 'Cotizacion configurada'} · {new Date(plan.exchangeRate.asOf).toLocaleDateString()}</Text>}
          <Text style={styles.planText}>{plan.audience !== 'profesional'
            ? 'Trabajos publicados: ' + (plan.limits.trabajosPublicados === -1 ? 'Sin limite' : plan.limits.trabajosPublicados)
            : 'Propuestas: ' + (plan.limits.propuestasEnviadas === -1 ? 'Sin limite' : plan.limits.propuestasEnviadas)}</Text>
        </View>)}
        {!freeAccount && <Text style={{ color: colores.textoSuave }}>Compras de {Platform.OS === 'ios' ? 'App Store' : 'Google Play'} aun no disponibles.</Text>}
        <Text style={[styles.subtitle, { color: colores.texto }]}>Pagos confirmados</Text>
        {billing.data?.payments.length === 0 && <Text style={{ color: colores.textoSuave }}>Todavia no hay pagos registrados.</Text>}
        {billing.data?.payments.map(payment => <View key={payment.id} style={[styles.band, { borderColor: colores.borde }]}>
          <Text style={{ color: colores.texto }}>{payment.currency} {(payment.amountMinor / 100).toLocaleString()} · {{ approved: 'Aprobado', refunded: 'Reintegrado', charged_back: 'Contracargo' }[payment.status]}</Text>
          <Text style={{ color: colores.textoSuave }}>Mercado Pago #{payment.id} · {new Date(payment.paidAt).toLocaleDateString()}</Text>
          {payment.refundedMinor > 0 && <Text style={{ color: colores.texto }}>Reintegrado: {(payment.refundedMinor / 100).toLocaleString()}</Text>}
        </View>)}
      </>}
      {!!message && <Text accessibilityLiveRegion="polite" style={{ color: colores.texto }}>{message}</Text>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  root: { flex: 1 }, content: { padding: 20, gap: 16, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: '700' }, subtitle: { fontSize: 18, fontWeight: '600' },
  band: { paddingVertical: 16, gap: 10, borderBottomWidth: 1 },
  plan: { padding: 20, borderRadius: 8, gap: 8 }, planName: { color: '#25332c', fontSize: 18, fontWeight: '700' },
  price: { color: '#25332c', fontSize: 24, fontWeight: '700' }, planText: { color: '#34423c', fontSize: 14 },
  button: { flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 48, borderRadius: 6, borderWidth: 1, padding: 12 },
  error: { backgroundColor: '#fff1f2', color: '#862e3a', padding: 12 },
});
