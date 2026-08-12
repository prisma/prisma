import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    typecheck: {
      enabled: true,
      include: ['test/**/*.test-d.ts'],
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['dist/**', 'test/**', '**/*.test.ts', '**/*.config.ts', '**/index.ts'],
      thresholds: {
        lines: 85,
        branches: 81,
        functions: 95,
        statements: 85,
      },
    },
  },
});
