/**
 * @archivo LandingLayout.tsx
 * @descripcion Layout para la página de aterrizaje (landing page) de OfiAI.
 * @modulo Layouts
 */
import { ReactNode } from 'react';

export const LandingLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen bg-white">
      {/* TODO: Navbar de marketing con CTA */}
      <nav className="h-16 border-b border-border flex items-center justify-between px-6 lg:px-12">
        <div className="text-2xl font-bold text-brand-700">OfiAI</div>
        <div className="flex gap-3">
          {/* TODO: Botones de Iniciar sesión y Registrarse */}
        </div>
      </nav>
      <main>{children}</main>
      {/* TODO: Footer con links legales, redes sociales y selector de idioma */}
    </div>
  );
};
