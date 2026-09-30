import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig({ command: 'serve', mode: 'test' }),
  defineConfig({
    test: {
      include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
      exclude: ['node_modules/**', 'e2e/**', 'dist/**'],
      coverage: {
        provider: 'v8',
        reporter: ['text-summary', 'text', 'lcov', 'json-summary'],
        // The 80% gate applies to core, deterministic logic. UI components are exercised by e2e, not unit tests.
        include: [
          'src/services/calculators.ts',
          'src/services/indiaTaxEngine.ts',
          'src/lib/market-protocol.ts',
          'src/lib/market-cache.ts',
          'src/lib/ws-client.ts',
          'server/ws/limits.ts',
          'server/ws/hub.ts',
          'server/rateLimiter.ts',
          'rag/rag_engine.ts',
          'server/fetch/*.ts',
          'server/v1/{envelope,params,calculators,auth,openapi,ai}.ts',
          'src/tax-engines/*.ts',
        ],
        thresholds: { lines: 80, functions: 80, statements: 80, branches: 75 },
      },
    },
  }),
);
