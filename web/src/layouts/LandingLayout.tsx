/**
 * @archivo LandingLayout.tsx
 * @descripcion Layout para la página de aterrizaje (landing page) de OfiAI.
 * @modulo Layouts
 */
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { WhatsAppContact } from './WhatsAppContact';

/**
 * Envuelve vistas públicas con navegación mínima de acceso.
 */
export const LandingLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen bg-white text-gray-950">
      <nav className="h-16 border-b border-border flex items-center justify-between px-6 lg:px-12">
        <div className="text-2xl font-bold text-brand-700">OfiAI</div>
        <div className="flex gap-3">
          <Link className="ofi-btn-secondary" to="/login">Ingresar</Link>
          <Link className="ofi-btn-primary" to="/register/company">Crear cuenta</Link>
        </div>
      </nav>
      <main>{children}</main>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-5 text-sm text-gray-500 lg:px-12">
        <p>OfiAI conecta demanda, talento y operaciones con IA aplicada a oficios.</p>
        <WhatsAppContact />
      </footer>
    </div>
  );
};
