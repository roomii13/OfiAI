/**
 * @archivo mobile/App.tsx
 * @descripcion Entrada principal de la aplicación móvil OfiAI para Expo.
 * Monta providers globales, navegación, área segura y barra de estado.
 */
import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProviderMobile } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation';
import { ThemeProviderMobile } from './src/providers/theme';

/**
 * Renderiza la aplicación móvil completa.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProviderMobile>
        <AuthProviderMobile>
          <StatusBar style="auto" />
          <AppNavigator />
        </AuthProviderMobile>
      </ThemeProviderMobile>
    </SafeAreaProvider>
  );
}
