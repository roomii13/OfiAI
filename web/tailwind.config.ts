import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class', // Preparado para modo oscuro
  theme: {
    extend: {
      // Paleta de colores OfiAI
      colors: {
        brand: {
          50: '#f0f0ff',
          100: '#e4e4ff',
          200: '#ccccfe',
          300: '#b0a8fc',
          400: '#9379f9',
          500: '#7c52f4',
          600: '#6c32e8',
          700: '#5d22d0',
          800: '#4d1da9',
          900: '#411c85',
          950: '#280f5c',
        },
        // Colores secundarios para el sistema de diseño
        surface: {
          DEFAULT: '#ffffff',
          secondary: '#f8f8fc',
          tertiary: '#f0f0f8',
        },
        border: {
          DEFAULT: '#e5e5f0',
          strong: '#c5c5d9',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08)',
        glass: '0 8px 32px rgba(108, 50, 232, 0.12)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        slideIn: { from: { transform: 'translateX(-8px)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
} satisfies Config;
