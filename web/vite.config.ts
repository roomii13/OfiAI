import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@context': path.resolve(__dirname, './src/context'),
      '@i18n': path.resolve(__dirname, './src/i18n'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@design-system': path.resolve(__dirname, './src/design-system'),
      '@layouts': path.resolve(__dirname, './src/layouts'),
      '@providers': path.resolve(__dirname, './src/providers'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
});
