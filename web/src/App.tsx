/**
 * @archivo App.tsx
 * @descripcion Componente raíz de la aplicación OfiAI.
 * Configura providers globales y el sistema de enrutamiento.
 * @modulo App
 */

import { BrowserRouter } from "react-router-dom";
import { AppRouter } from "./app/Router";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { LanguageProvider } from "./context/LanguageContext";

/**
 * Renderiza la aplicación web de OfiAI con sus providers globales.
 */
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AppRouter />
          </LanguageProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
