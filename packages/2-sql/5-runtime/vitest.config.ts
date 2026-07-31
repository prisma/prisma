import { timeouts } from '@repo/test-utils';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: timeouts.default,
    hookTimeout: timeouts.default,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'dist/**',
        'test/**',
        '**/*.test.ts',
        '**/*.test-d.ts',
        '**/*.config.ts',
        '**/exports/**',
        'src/lower-sql-plan.ts', // TODO(TML-1786): Add tests - currently 0% coverage
        'src/codecs/encoding.ts', // TODO(TML-1786): Add tests - currently 6% coverage
        'src/codecs/decoding.ts', // TODO(TML-1786): Add tests - currently 33% coverage
        'src/codecs/validation.ts', // TODO(TML-1786): Add tests - currently 50% coverage
        'src/marker.ts', // TODO(TML-1786): Add tests - relocated from runtime-executor in TML-2242, currently 10% coverage
        'src/guardrails/raw.ts', // TODO(TML-1786): Add tests - relocated from runtime-executor in TML-2242, currently 8% coverage
        'src/runtime-spi.ts', // SPI type declarations only (interfaces) - no executable statements to cover
        'src/middleware/sql-middleware.ts', // SqlMiddleware interface declarations only - no executable statements to cover
      ],
      thresholds: {
        lines: 90,
        branches: 80,
        functions: 92,
        statements: 90,
      },
    },
  },
});
