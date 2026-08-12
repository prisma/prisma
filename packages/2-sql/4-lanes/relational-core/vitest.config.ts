import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
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
        '**/index.ts', // Re-export file
        '**/types.ts', // Types-only file
        'src/utils/guards.ts', // Type guards tested indirectly through integration tests
        'src/ast/adapter-types.ts', // Types-only file
        'src/ast/driver-types.ts', // Types-only file
        'src/ast/predicate.ts', // Simple factory functions tested indirectly through integration tests
        'src/query-lane-context.ts', // Types-only file
      ],
      thresholds: {
        lines: 96,
        branches: 95,
        functions: 95,
        statements: 96,
      },
    },
  },
});
