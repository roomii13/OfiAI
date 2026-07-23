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

/**
 * @component AppProviders
 * @description
 * Punto central donde se agregarán los providers globales:
 *
 * - AuthProvider
 * - ThemeProvider
 * - LanguageProvider
 * - QueryClientProvider
 * - NotificationProvider
 */
function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}


/**
 * @component AppContainer
 * @description
 * Contenedor principal.
 *
 * En próximas fases será reemplazado por:
 *
 * <AppRouter />
 *
 * con:
 * - rutas públicas
 * - rutas privadas
 * - control de roles:
 *   - Empresa
 *   - Profesional
 *   - Administrador
 */
function AppContainer() {
  return (
    <main className="min-h-screen bg-surface font-sans">
      <section className="p-8">
        <h1 className="text-4xl font-bold text-brand-700">
          OfiAI 🚀
        </h1>

        <p className="mt-4 text-gray-600">
          Plataforma inteligente que conecta empresas con
          profesionales mediante IA.
        </p>

        <div className="mt-8 rounded-xl border p-6 bg-white shadow-sm">
          <h2 className="text-xl font-semibold">
            Arquitectura inicial cargada
          </h2>

          <ul className="mt-4 space-y-2 text-gray-600">
            <li>✅ React + TypeScript + Vite</li>
            <li>✅ TailwindCSS configurado</li>
            <li>✅ Router preparado</li>
            <li>✅ Sistema de providers preparado</li>
            <li>⏳ Auth pendiente</li>
            <li>⏳ Dashboards pendientes</li>
            <li>⏳ IA Gemini pendiente</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

export default App;