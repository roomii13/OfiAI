/**
 * @archivo jest.config.js
 * @descripcion Configuración de Jest para pruebas unitarias, integración y API del backend OfiAI.
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  clearMocks: true,
  setupFiles: ['<rootDir>/tests/setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '\\.emulator\\.test\\.ts$'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts',
    '!src/config/**',
    '!src/integrations/firebase/admin.ts',
  ],
};
