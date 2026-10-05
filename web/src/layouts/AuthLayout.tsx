/**
 * @archivo AuthLayout.tsx
 * @descripcion Layout para páginas de autenticación de OfiAI.
 * Presenta formularios de acceso junto a una vista operacional del producto.
 * @modulo Layouts
 */
import { ReactNode } from 'react';
import loginBackground from '../assets/login-handshake.png';
import { WhatsAppContact } from './WhatsAppContact';

/** Opciones del layout; la fotografia se limita a la pantalla de login. */
interface AuthLayoutProps {
  children: ReactNode;
  withBackground?: boolean;
}

/**
 * Envuelve formularios de autenticación con una composición responsive.
 */
export const AuthLayout = ({ children, withBackground = false }: AuthLayoutProps) => {
  if (withBackground) {
    return (
      <main className="ofi-login">
        <img className="ofi-login-image" src={loginBackground} alt="" aria-hidden="true" fetchPriority="high" />
        <div className="ofi-login-veil" aria-hidden="true" />
        <div className="ofi-login-container">
          <div className="ofi-login-form">
            {children}
            <div className="mt-5 flex justify-center"><WhatsAppContact /></div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen grid bg-surface-secondary lg:grid-cols-[minmax(0,0.92fr)_minmax(420px,1fr)]">
      <div className="flex items-center justify-center bg-white p-6 sm:p-8">
        <div className="w-full max-w-md">
          {children}
          <div className="mt-5 flex justify-center"><WhatsAppContact /></div>
        </div>
      </div>

      <div className="hidden border-l border-border bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="text-3xl font-extrabold">OfiAI</div>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
            Operación, contratación, pagos y asistencia IA para empresas y profesionales de oficios.
          </p>
        </div>

      </div>
    </div>
  );
};
