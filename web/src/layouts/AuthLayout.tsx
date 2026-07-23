/**
 * @archivo AuthLayout.tsx
 * @descripcion Layout para páginas de autenticación de OfiAI.
 * Diseño de pantalla dividida: formulario izquierda, imagen/branding derecha.
 * @modulo Layouts
 */
import { ReactNode } from 'react';

export const AuthLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen flex">
      {/* Panel izquierdo: Formulario */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
      {/* Panel derecho: Branding OfiAI */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-brand-600 to-brand-900 items-center justify-center p-12">
        <div className="text-white text-center">
          <div className="text-5xl font-extrabold mb-4">OfiAI</div>
          <p className="text-brand-200 text-lg max-w-sm">
            La plataforma de IA para conectar empresas con los mejores profesionales de oficios en LATAM
          </p>
          {/* TODO: Agregar imagen/ilustración de la plataforma */}
          {/* TODO: Agregar testimonios o estadísticas de clientes */}
        </div>
      </div>
    </div>
  );
};
