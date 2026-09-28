// ESLint is enforced on the modules added for RAG, market streaming and CI. The rest of the codebase
// is still gated by `tsc --noEmit` (npm run lint) and will be brought under ESLint incrementally.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export const LINTED = [
  'rag/rag_engine.ts',
  'server/ws-market.ts',
  'server/ws/**/*.ts',
  'src/lib/market-protocol.ts',
  'src/lib/market-cache.ts',
  'src/lib/ws-client.ts',
  'src/lib/precision-client.ts',
  'server/precisionRoutes.ts',
  'tests/precisionClient.test.ts',
  'tests/ws*.test.ts',
  'tests/marketCache.test.ts',
  'tests/ragEngine.test.ts',
  'tests/authMiddleware.test.ts',
  'tests/calculators.edge.test.ts',
  'tests/taxEngine.edge.test.ts',
  'tests/integration/**/*.ts',
  'e2e/**/*.ts',
  'playwright.config.ts',
  'vitest.config.ts',
];

export default tseslint.config(
  { ignores: ['dist/**', 'api/**', 'node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**'] },
  {
    files: LINTED,
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
);
