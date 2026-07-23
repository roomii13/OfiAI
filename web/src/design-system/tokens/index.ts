/**
 * @archivo tokens/index.ts
 * @descripcion Design Tokens del sistema de diseño OfiAI.
 * Fuente única de verdad para todos los valores visuales del sistema.
 * Sincronizado con tailwind.config.ts
 * @modulo Design System
 */
export const TOKENS = {
  colores: {
    marca: {
      primario: '#6c32e8',
      secundario: '#9379f9',
      claro: '#f0f0ff',
    },
    texto: {
      primario: '#1e1b4b',
      secundario: '#6b7280',
      silenciado: '#9ca3af',
    },
    fondo: {
      primario: '#ffffff',
      secundario: '#f8f8fc',
      terciario: '#f0f0f8',
    },
    estado: {
      exito: '#10b981',
      advertencia: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    },
  },
  tipografia: {
    familia: "'Inter', system-ui, sans-serif",
    pesos: { normal: 400, medio: 500, semibold: 600, bold: 700, extrabold: 800 },
    tamanos: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem', '2xl': '1.5rem', '3xl': '1.875rem' },
  },
  espaciado: {
    base: '4px',
    // Usa la escala de Tailwind: 1=4px, 2=8px, 4=16px, 6=24px, 8=32px
  },
  radios: {
    sm: '8px', md: '12px', lg: '16px', xl: '24px', full: '9999px',
  },
  sombras: {
    tarjeta: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
    tarjetaHover: '0 4px 12px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08)',
    vidrio: '0 8px 32px rgba(108, 50, 232, 0.12)',
  },
  transiciones: {
    rapida: '150ms ease',
    normal: '250ms ease',
    lenta: '350ms ease',
  },
} as const;
