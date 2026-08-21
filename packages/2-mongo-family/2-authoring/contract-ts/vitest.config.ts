import { timeouts } from '@repo/test-utils';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: timeouts.default,
    hookTimeout: timeouts.default,
    typecheck: {
      enabled: true,
      include: ['test/**/*.test-d.ts'],
    },
  },
});
