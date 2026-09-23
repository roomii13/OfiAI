/**
 * @archivo typography/index.ts
 * @descripcion Sistema tipográfico de OfiAI.
 * @modulo Design System
 */
export const TIPOGRAFIA = {
  fuente: "'Inter', system-ui, sans-serif",
  escala: {
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

export const CLASES_TIPOGRAFIA = {
  display: 'text-5xl leading-tight font-extrabold',
  h1: 'text-4xl leading-tight font-bold',
  h2: 'text-3xl leading-snug font-bold',
  h3: 'text-2xl leading-snug font-semibold',
  cuerpo: 'text-base leading-relaxed font-normal',
  micro: 'text-xs leading-normal font-normal',
} as const;
