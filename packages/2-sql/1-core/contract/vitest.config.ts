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
        '**/types.ts',
        'src/index.ts', // Barrel file with only re-exports
        'src/pack-types.ts', // Pure type definitions, no executable code
        // IR classes covered through integration paths today; per-class unit
        // tests are tracked as a follow-up before the 0.9 release ships.
        'src/ir/sql-storage.ts',
        'src/ir/storage-column.ts',
        'src/ir/storage-table.ts',
        'src/ir/storage-type-instance.ts',
        'src/ir/unique-constraint.ts',
        'src/index-type-validation.ts',
      ],
      thresholds: {
        lines: 90,
        branches: 85,
        functions: 92,
        statements: 91,
      },
    },
  },
});
