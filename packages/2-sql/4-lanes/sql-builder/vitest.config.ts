import { timeouts } from '@repo/test-utils';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    typecheck: {
      include: ['test/**/*.test-d.ts'],
    },
    globals: true,
    environment: 'node',
    testTimeout: timeouts.default,
    hookTimeout: timeouts.default,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['dist/**', 'test/**', '**/*.test.ts', '**/*.test-d.ts', '**/*.config.ts'],
    },
  },
});
