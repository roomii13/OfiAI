/** @archivo eslint.config.mjs @descripcion Lint TypeScript estricto del backend. */
import parser from '@typescript-eslint/parser';
import typescript from '@typescript-eslint/eslint-plugin';
export default [
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: { parser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
    plugins: { '@typescript-eslint': typescript },
    rules: { ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] },
  },
];
