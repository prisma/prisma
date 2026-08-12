import { defineConfig } from 'vitest/config';

const testTimeout = (Number.parseFloat(process.env['TEST_TIMEOUT_MULTIPLIER'] ?? '1') || 1) * 500;

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout,
    hookTimeout: testTimeout,
    typecheck: {
      include: ['test/**/*.test-d.ts'],
    },
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
        'schemas/**',
        '**/types.ts',
        '**/contract-types.ts',
        '**/domain-types.ts',
      ],
      thresholds: {
        lines: 90,
        branches: 94,
        functions: 95,
        statements: 95,
      },
    },
  },
});
