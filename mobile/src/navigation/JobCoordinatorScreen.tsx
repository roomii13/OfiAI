/** @archivo JobCoordinatorScreen.tsx @descripcion Detalle bilateral, acciones del servidor, presupuestos, agenda e historial. */
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CoordinatorAction, CoordinatorView } from '../../../shared/coordinator';
import type { AppTabParamList } from '../types';
import { useAuthMobile } from '../context/AuthContext';
import { useThemeMobile } from '../providers/theme';
import { canStartCoordinator, useCoordinator } from '../lib/coordinator';
import { coordinatorActions, coordinatorDate, coordinatorStates } from '../lib/coordinatorPresentation';
import { CoordinatorButton, coordinatorStyles as s } from './CoordinatorUi';
import { CoordinatorActionSheet, type CoordinatorSheetAction } from './CoordinatorActionSheet';
import { CoordinatorQuoteTerms, CoordinatorScheduleTerms } from './CoordinatorTerms';

/** Aisla datos, formularios e intentos por cuenta, rol y trabajo seleccionado. */
export function JobCoordinatorScreen() {
  const { usuario } = useAuthMobile();
  const route = useRoute<RouteProp<AppTabParamList, 'JobCoordinator'>>();
  if (!usuario || !['empresa', 'profesional'].includes(usuario.rol)) return <Text>Coordinacion disponible para empresas y profesionales.</Text>;
  if (!route.params?.jobId) return <Text>Selecciona un trabajo para coordinar.</Text>;
  return <CoordinatorDetail key={usuario.uid + ':' + usuario.rol + ':' + route.params.jobId} jobId={route.params.jobId} />;
}

/** Muestra unicamente estado persistido y comandos recomendados por advice.actions. */
function CoordinatorDetail({ jobId }: { jobId: string }) {
  const { colores } = useThemeMobile(); const focused = useIsFocused();
  const navigation = useNavigation<BottomTabNavigationProp<AppTabParamList>>();
  const coordinator = useCoordinator(jobId); const view = coordinator.view; const workflow = view?.workflow;
  const [sheet, setSheet] = useState<{ action: CoordinatorSheetAction; snapshot: CoordinatorView } | null>(null);
  useEffect(() => { if (!focused) setSheet(null); }, [focused]);
  /** Guarda los terminos y revision que la persona esta a punto de confirmar. */
  function open(action: CoordinatorSheetAction): void { if (view) setSheet({ action, snapshot: view }); }

  return <SafeAreaView style={[s.root, { backgroundColor: colores.fondo }]}>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <CoordinatorButton label="Bandeja de coordinaciones" icon="albums-outline" onPress={() => navigation.navigate('Coordinator')} />
      <Text accessibilityRole="header" style={[s.title, { color: colores.texto }]}>Coordinacion del trabajo</Text>
      {coordinator.error ? <Text accessibilityRole="alert" style={s.error}>{coordinator.error}</Text> : null}
      {coordinator.busy && <ActivityIndicator accessibilityLabel="Cargando coordinacion" color={colores.primario} />}
      <CoordinatorButton label="Actualizar estado" icon="refresh" disabled={coordinator.busy} onPress={() => { void coordinator.reload(); }} />
      {view && <>
        <Text style={[s.subtitle, { color: colores.texto }]}>{view.job.title}</Text>
        <Text style={{ color: colores.textoSuave }}>{view.job.category} · {view.job.location.city ?? 'Ubicacion por confirmar'}</Text>
        <Text style={{ color: colores.texto }}>Tu rol: {view.role === 'empresa' ? 'Empresa' : 'Profesional'}</Text>
        {view.role === 'empresa' && <>
          <CoordinatorButton label="Ver estimacion de precio" icon="calculator-outline" onPress={() => navigation.navigate('JobPricing', { jobId })} />
          <CoordinatorButton label="Ver profesionales" icon="people-outline" onPress={() => navigation.navigate('JobMatches', { jobId })} />
        </>}
        <View style={[s.band, { borderColor: colores.borde }]}>
          <Text style={[s.subtitle, { color: colores.texto }]}>{workflow ? coordinatorStates[workflow.state] : 'Coordinacion no iniciada'}</Text>
          {workflow && <>
            <Text style={{ color: colores.texto }}>Profesional: {workflow.professionalName}</Text>
            <Text style={{ color: colores.textoSuave }}>Revision {workflow.revision} · {coordinatorDate(workflow.updatedAt)}</Text>
            {workflow.pricingInsufficient && <Text style={{ color: colores.texto }}>La estimacion tiene informacion insuficiente. Puedes continuar para solicitar un presupuesto al profesional.</Text>}
          </>}
          <Text style={{ color: colores.texto }}>{view.advice.message}</Text>
          {view.advice.waitingFor && <Text style={{ color: colores.textoSuave }}>Pendiente de: {view.advice.waitingFor === 'empresa' ? 'empresa' : 'profesional'}</Text>}
        </View>
        {coordinator.pending ? <View style={s.section}>
          <Text style={{ color: colores.texto }}>Hay un envio sin confirmar. Puede haberse aplicado en el servidor.</Text>
          <CoordinatorButton label="Reintentar envio" icon="refresh" disabled={coordinator.busy} onPress={() => open('retry')} />
          <CoordinatorButton label="Descartar reintento y consultar estado" icon="sync-outline" disabled={coordinator.busy} onPress={() => open('discard')} />
        </View> : <>
          {canStartCoordinator(view) && <CoordinatorButton label={workflow ? 'Reiniciar coordinacion' : 'Iniciar coordinacion'} icon="add-circle-outline" primary disabled={coordinator.busy} onPress={() => open('start')} />}
          {workflow && view.advice.actions.map(action => <CoordinatorButton key={action} label={coordinatorActions[action]} primary={action !== 'cancel'}
            disabled={coordinator.busy} onPress={() => open(action)} />)}
          {workflow && !view.advice.actions.length && <Text style={{ color: colores.textoSuave }}>No hay acciones disponibles para tu rol en este estado.</Text>}
        </>}
        <Text accessibilityRole="header" style={[s.subtitle, { color: colores.texto }]}>Presupuesto vigente</Text>
        {workflow?.offer ? <View style={s.section}>
          <Text style={{ color: colores.textoSuave }}>Propuesto por {workflow.offer.proposedBy} · {workflow.offer.accepted ? 'Aceptado' : 'Pendiente de aceptacion'}</Text>
          <CoordinatorQuoteTerms quote={workflow.offer.quote} />
        </View> : <Text style={{ color: colores.textoSuave }}>Sin presupuesto propuesto.</Text>}
        <Text accessibilityRole="header" style={[s.subtitle, { color: colores.texto }]}>Agenda</Text>
        {workflow?.schedule ? <View style={s.section}>
          <Text style={{ color: colores.textoSuave }}>Propuesta por {workflow.schedule.proposedBy} · {workflow.schedule.confirmed ? 'Confirmada' : 'Pendiente de confirmacion'}</Text>
          <CoordinatorScheduleTerms schedule={workflow.schedule} />
        </View> : <Text style={{ color: colores.textoSuave }}>Sin horario propuesto.</Text>}
        {workflow?.completionRequested && <Text style={{ color: colores.texto }}>Finalizacion informada por el profesional.</Text>}
        <Text accessibilityRole="header" style={[s.subtitle, { color: colores.texto }]}>Historial</Text>
        {!view.history.length && <Text style={{ color: colores.textoSuave }}>Sin movimientos registrados.</Text>}
        {view.history.map((entry, index) => <View key={entry.at + ':' + entry.revision + ':' + index} style={[s.item, { borderColor: colores.borde }]}>
          <Text style={{ color: colores.texto }}>{coordinatorActions[entry.action as CoordinatorAction] ?? entry.action} · {entry.actor}</Text>
          <Text style={{ color: colores.texto }}>{coordinatorStates[entry.from]} a {coordinatorStates[entry.to]}</Text>
          <Text style={{ color: colores.textoSuave }}>Revision {entry.revision} · {coordinatorDate(entry.at)}</Text>
          {entry.note && <Text style={{ color: colores.texto }}>{entry.note}</Text>}
        </View>)}
      </>}
    </ScrollView>
    {sheet && <CoordinatorActionSheet action={sheet.action} snapshot={sheet.snapshot} coordinator={coordinator} onClose={() => setSheet(null)} />}
  </SafeAreaView>;
}
