import { timeouts } from '@repo/test-utils';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: timeouts.spinUpMongoMemoryServer,
    hookTimeout: timeouts.spinUpMongoMemoryServer,
    fileParallelism: false,
    sequence: { groupOrder: 4 },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx,js,jsx}'],
      exclude: [
        'dist/**',
        'test/**',
        '**/*.test.ts',
        '**/*.test-d.ts',
        '**/*.spec.ts',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/exports/**',
        '**/mongo-runner.ts',
      ],
      reporter: ['text', 'html'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
