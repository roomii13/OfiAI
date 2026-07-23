/**
 * @archivo DashboardLayout.tsx
 * @descripcion Layout principal para los dashboards de OfiAI.
 * Incluye sidebar de navegación, header y área de contenido.
 * Se adapta según el rol del usuario (empresa/profesional/admin).
 * @modulo Layouts
 */
import { ReactNode } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
  // TODO: Recibir rol del usuario para personalizar la navegación
}

/**
 * Layout del dashboard.
 * TODO: Implementar Sidebar con navegación por rol
 * TODO: Implementar Header con notificaciones, perfil y selector de idioma
 * TODO: Implementar indicador del plan de suscripción activo
 * TODO: Implementar breadcrumb de navegación
 */
export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return (
    <div className="flex h-screen bg-surface-secondary">
      {/* TODO: Sidebar */}
      <aside className="w-64 bg-white border-r border-border flex-shrink-0">
        <div className="p-6">
          <div className="text-2xl font-bold text-brand-700">OfiAI</div>
          <p className="text-xs text-gray-400 mt-1">Sidebar — TODO</p>
        </div>
      </aside>
      {/* Área principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TODO: Header */}
        <header className="h-16 bg-white border-b border-border flex items-center px-6">
          <p className="text-sm text-gray-400">Header — TODO</p>
        </header>
        {/* Contenido del dashboard */}
        <main className="flex-1 overflow-y-auto p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
};
