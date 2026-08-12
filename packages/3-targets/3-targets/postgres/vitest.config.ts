import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx,js,jsx}'],
      exclude: [
        'dist/**',
        'test/**',
        '**/*.test.ts',
        '**/*.test-d.ts',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/exports/**',
        // runner.ts applies migration plans against a live SqlControlDriverInstance;
        // it is exercised end-to-end by the adapter-postgres runner.*.integration.test.ts
        // suites (a separate vitest config the per-package report can't attribute) and
        // cannot be meaningfully unit-tested without a live driver.
        'src/core/migrations/runner.ts',
      ],
      reporter: ['text', 'html'],
      thresholds: {
        lines: 79,
        branches: 65,
        functions: 88,
        statements: 79,
      },
    },
  },
});
