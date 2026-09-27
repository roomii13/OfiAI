/** @archivo CoordinatorUi.tsx @descripcion Controles nativos compartidos por bandeja, detalle y formularios Coordinator. */
import type { ComponentProps, ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeMobile } from '../providers/theme';

/** Comando accesible con area tactil estable y etiqueta que puede ocupar varias lineas. */
export function CoordinatorButton({ label, onPress, disabled = false, icon, primary = false }: {
  label: string; onPress: () => void; disabled?: boolean; icon?: ComponentProps<typeof Ionicons>['name']; primary?: boolean;
}) {
  const { colores } = useThemeMobile(); const color = primary ? '#fff' : colores.texto;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[coordinatorStyles.button, { borderColor: colores.borde, backgroundColor: primary ? colores.primario : colores.superficie, opacity: disabled ? .5 : 1 }]}>
    {icon && <Ionicons name={icon} size={20} color={color} accessible={false} />}
    <Text style={{ color, flexShrink: 1, textAlign: 'center', fontWeight: '600' }}>{label}</Text>
  </Pressable>;
}

/** Campo con etiqueta persistente y teclado compatible con importes decimales. */
export function CoordinatorField({ label, value, onChange, numeric = false, multiline = false, maxLength = 100, disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; numeric?: boolean; multiline?: boolean; maxLength?: number; disabled?: boolean;
}) {
  const { colores } = useThemeMobile();
  return <View style={coordinatorStyles.section}><Text style={{ color: colores.texto }}>{label}</Text>
    <TextInput accessibilityLabel={label} editable={!disabled} value={value} onChangeText={onChange} maxLength={maxLength}
      autoCapitalize="none" autoCorrect={false} keyboardType={numeric ? 'decimal-pad' : 'default'} multiline={multiline}
      style={[coordinatorStyles.input, { color: colores.texto, borderColor: colores.borde, minHeight: multiline ? 90 : 48 }]} />
  </View>;
}

/** Grupo radio con opciones del contrato y sin cambios implicitos de valor. */
export function CoordinatorChoices<T extends string>({ label, value, options, onChange, disabled = false }: {
  label: string; value: T; options: Record<T, string>; onChange: (value: T) => void; disabled?: boolean;
}) {
  const { colores } = useThemeMobile();
  return <View style={coordinatorStyles.section}><Text style={{ color: colores.texto }}>{label}</Text>
    {(Object.keys(options) as T[]).map(key => <Pressable key={key} accessibilityRole="radio" accessibilityLabel={label + ': ' + options[key]}
      accessibilityState={{ selected: value === key, disabled }} disabled={disabled} onPress={() => onChange(key)}
      style={[coordinatorStyles.choice, { borderColor: colores.borde }]}>
      <Ionicons name={value === key ? 'radio-button-on' : 'radio-button-off'} size={22} color={colores.primario} accessible={false} />
      <Text style={{ color: colores.texto, flex: 1 }}>{options[key]}</Text>
    </Pressable>)}
  </View>;
}

/** Consentimiento desmarcado por defecto y separado del boton de envio. */
export function CoordinatorConsent({ label, checked, onChange, disabled = false }: {
  label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean;
}) {
  const { colores } = useThemeMobile();
  return <View style={coordinatorStyles.row}><Switch accessibilityLabel={label} value={checked} onValueChange={onChange} disabled={disabled} />
    <Text style={{ color: colores.texto, flex: 1 }}>{label}</Text></View>;
}

/** Hoja modal con teclado, scroll y Back nativo; el padre decide cuando es seguro cerrar. */
export function CoordinatorSheet({ title, onClose, busy, children }: { title: string; onClose: () => void; busy: boolean; children: ReactNode }) {
  const { colores } = useThemeMobile();
  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!busy) onClose(); }}>
    <SafeAreaView style={[coordinatorStyles.root, { backgroundColor: colores.fondo }]}>
      <KeyboardAvoidingView style={coordinatorStyles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={coordinatorStyles.content} keyboardShouldPersistTaps="handled">
          <CoordinatorButton label="Cerrar" icon="close" disabled={busy} onPress={onClose} />
          <Text accessibilityRole="header" style={[coordinatorStyles.title, { color: colores.texto }]}>{title}</Text>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

export const coordinatorStyles = StyleSheet.create({
  root: { flex: 1 }, content: { padding: 16, paddingBottom: 40, gap: 16 }, title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 17, fontWeight: '600' }, section: { gap: 8 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  band: { gap: 10, paddingVertical: 16, borderBottomWidth: 1 }, item: { gap: 8, paddingVertical: 16, borderBottomWidth: 1 },
  input: { borderWidth: 1, borderRadius: 6, padding: 12, fontSize: 16 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 48, padding: 12, borderWidth: 1, borderRadius: 6 },
  choice: { flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 48, borderBottomWidth: 1 },
  error: { color: '#862e3a', backgroundColor: '#fff0f1', padding: 12 },
});
