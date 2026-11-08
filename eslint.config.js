import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/dist/', '**/.wrangler/', '**/worker-configuration.d.ts']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.tsx'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['scripts/**', '**/*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
]);
