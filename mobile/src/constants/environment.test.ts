/** @archivo environment.test.ts @descripcion Verifica configuracion publica incrustada por Metro, sin leer credenciales. */
import { transformFileSync } from '@babel/core';
import { resolve } from 'node:path';

it('compila la URL y Firebase con el preset Expo sin depender de process nativo', () => {
  const previous = { ...process.env };
  try {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/api/v1';
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'demo-ofiai-build';
    const caller = { name: 'metro', bundler: 'metro', platform: 'android', isDev: false, supportsStaticESM: true };
    const result = transformFileSync(resolve(__dirname, 'index.ts'), {
      configFile: false, babelrc: false, envName: 'production', presets: ['babel-preset-expo'],
      caller,
    });
    expect(result?.code).toContain('https://api.example.test/api/v1');
    expect(result?.code).toContain('demo-ofiai-build');
    expect(result?.code).not.toMatch(/process\.env\.EXPO_PUBLIC_/);
  } finally { process.env = previous; }
});
