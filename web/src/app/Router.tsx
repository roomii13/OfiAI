/**
 * @archivo Router.tsx
 * @descripcion
 * Sistema principal de rutas de OfiAI.
 *
 * Gestiona:
 * - rutas públicas
 * - rutas autenticadas
 * - rutas por rol
 *
 * Roles:
 * - Empresa
 * - Profesional
 * - Administrador
 *
 * @modulo Routing
 */

import { Routes, Route, Navigate } from "react-router-dom";


/**
 * Rutas públicas
 *
 * Disponibles sin autenticación:
 * - Landing
 * - Login
 * - Registro
 * - Recuperar contraseña
 */
function PublicRoutes() {
  return (
    <>
      <Route
        path="/"
        element={<LandingPlaceholder />}
      />

      <Route
        path="/login"
        element={<LoginPlaceholder />}
      />

      <Route
        path="/register"
        element={<RegisterPlaceholder />}
      />

      <Route
        path="/forgot-password"
        element={<ForgotPasswordPlaceholder />}
      />
    </>
  );
}


/**
 * Rutas privadas
 *
 * Más adelante estarán protegidas
 * por AuthProvider.
 */
function PrivateRoutes() {
  return (
    <>
      <Route
        path="/dashboard"
        element={<DashboardPlaceholder />}
      />


      {/* Empresa */}
      <Route
        path="/company/*"
        element={<CompanyPlaceholder />}
      />


      {/* Profesional */}
      <Route
        path="/professional/*"
        element={<ProfessionalPlaceholder />}
      />


      {/* Administrador */}
      <Route
        path="/admin/*"
        element={<AdminPlaceholder />}
      />
    </>
  );
}


/**
 * Router principal
 */
export function AppRouter() {
  return (
    <Routes>

      {PublicRoutes()}

      {PrivateRoutes()}


      {/* Ruta desconocida */}
      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />

    </Routes>
  );
}



/**
 * COMPONENTES TEMPORALES
 *
 * Se reemplazarán por:
 *
 * features/
 * ├── auth
 * ├── dashboard
 * ├── companies
 * ├── professionals
 * └── admin
 */


function LandingPlaceholder() {
  return (
    <Page title="OfiAI">
      Plataforma inteligente de conexión laboral con IA.
    </Page>
  );
}


function LoginPlaceholder() {
  return (
    <Page title="Login">
      Inicio de sesión pendiente.
    </Page>
  );
}


function RegisterPlaceholder() {
  return (
    <Page title="Registro">
      Registro de usuarios pendiente.
    </Page>
  );
}


function ForgotPasswordPlaceholder() {
  return (
    <Page title="Recuperar contraseña">
      Recuperación pendiente.
    </Page>
  );
}


function DashboardPlaceholder() {
  return (
    <Page title="Dashboard">
      Dashboard principal pendiente.
    </Page>
  );
}


function CompanyPlaceholder() {
  return (
    <Page title="Empresa">
      Panel de empresa pendiente.
    </Page>
  );
}


function ProfessionalPlaceholder() {
  return (
    <Page title="Profesional">
      Panel profesional pendiente.
    </Page>
  );
}


function AdminPlaceholder() {
  return (
    <Page title="Administrador">
      Panel administrador pendiente.
    </Page>
  );
}



function Page({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">

      <div className="text-center p-8">

        <h1 className="text-3xl font-bold text-brand-700">
          {title}
        </h1>

        <p className="mt-3 text-gray-600">
          {children}
        </p>

      </div>

    </div>
  );
}