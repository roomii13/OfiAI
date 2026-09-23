/**
 * @archivo jest.config.cjs
 * @descripcion Pruebas Expo 50 con modulos nativos aislados, sin credenciales.
 */
module.exports = {
  preset: 'jest-expo',
  transform: { '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
  testMatch: ['<rootDir>/src/**/*.test.tsx'],
  clearMocks: true,
};
