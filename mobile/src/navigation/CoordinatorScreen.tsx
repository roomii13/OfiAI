/** @archivo CoordinatorScreen.tsx @descripcion Bandeja real de coordinaciones para empresa y profesional. */
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuthMobile } from '../context/AuthContext';
import { useThemeMobile } from '../providers/theme';
import { useCoordinatorList } from '../lib/coordinator';
import { coordinatorDate, coordinatorStates } from '../lib/coordinatorPresentation';
import type { AppTabParamList } from '../types';
import { CoordinatorButton, coordinatorStyles as s } from './CoordinatorUi';

/** No consulta datos sin un participante autenticado; remonta al cambiar de cuenta o rol. */
export function CoordinatorScreen() {
  const { usuario } = useAuthMobile();
  if (!usuario || !['empresa', 'profesional'].includes(usuario.rol)) return <Text>Coordinacion disponible para empresas y profesionales.</Text>;
  return <CoordinatorInbox key={usuario.uid + ':' + usuario.rol} />;
}

/** Lista virtualizada con cursor, refresco, error recuperable y vacio sin datos inventados. */
function CoordinatorInbox() {
  const { colores } = useThemeMobile();
  const navigation = useNavigation<BottomTabNavigationProp<AppTabParamList>>();
  const list = useCoordinatorList();
  return <SafeAreaView style={[s.root, { backgroundColor: colores.fondo }]}>
    <FlatList data={list.data?.items ?? []} keyExtractor={item => item.jobId} contentContainerStyle={s.content}
      refreshing={list.busy} onRefresh={list.reload}
      ListHeaderComponent={<View style={s.section}>
        <Text accessibilityRole="header" style={[s.title, { color: colores.texto }]}>Coordinaciones</Text>
        <CoordinatorButton label="Mis trabajos" icon="briefcase-outline" onPress={() => navigation.navigate('Trabajos')} />
        <CoordinatorButton label="Actualizar bandeja" icon="refresh" disabled={list.busy} onPress={list.reload} />
        {list.error ? <Text accessibilityRole="alert" style={s.error}>{list.error}</Text> : null}
        {list.busy && <ActivityIndicator accessibilityLabel="Cargando coordinaciones" color={colores.primario} />}
      </View>}
      ListEmptyComponent={list.data && !list.busy && !list.error ? <Text style={{ color: colores.textoSuave }}>No hay coordinaciones para mostrar.</Text> : null}
      renderItem={({ item }) => <View style={[s.item, { borderColor: colores.borde }]}>
        <Text style={[s.subtitle, { color: colores.texto }]}>{item.title}</Text>
        <Text style={{ color: colores.texto }}>{coordinatorStates[item.state]}</Text>
        <Text style={{ color: colores.textoSuave }}>{coordinatorDate(item.updatedAt)}</Text>
        <CoordinatorButton label={'Abrir coordinacion: ' + item.title} icon="chevron-forward" onPress={() => navigation.navigate('JobCoordinator', { jobId: item.jobId })} />
      </View>}
      ListFooterComponent={list.data?.nextCursor ? <CoordinatorButton label="Cargar mas coordinaciones" icon="chevron-down" disabled={list.busy} onPress={list.loadMore} /> : null} />
  </SafeAreaView>;
}
