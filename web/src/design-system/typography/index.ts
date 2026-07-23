/**
 * @archivo typography/index.ts
 * @descripcion Sistema tipográfico de OfiAI.
 * @modulo Design System
 * TODO: Agregar clases utilitarias de tipografía reutilizables
 */
export const TIPOGRAFIA = {
  fuente: "'Inter', system-ui, sans-serif",
  escala: {
    // nombre: [tamaño, altura de línea, peso]
    display: ['3rem', '1.2', '800'],
    h1: ['2.25rem', '1.25', '700'],
    h2: ['1.875rem', '1.3', '700'],
    h3: ['1.5rem', '1.35', '600'],
    h4: ['1.25rem', '1.4', '600'],
    cuerpo: ['1rem', '1.6', '400'],
    pequeño: ['0.875rem', '1.5', '400'],
    micro: ['0.75rem', '1.4', '400'],
  },
} as const;
