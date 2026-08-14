import { timeouts } from '@repo/test-utils';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Note: do not change to 'threads', it will cause the failure
    // `TypeError: process.chdir() is not supported in workers`.
    pool: 'forks',
    maxWorkers: 1,
    isolate: false,
    fileParallelism: false,
    sequence: { groupOrder: 1 },
    testTimeout: timeouts.vitestPackageDefault,
    hookTimeout: timeouts.vitestPackageDefault,
    setupFiles: ['./test/setup.ts'],
    env: {
      CI: 'true',
      NO_COLOR: '1',
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
        // Formatting/wrangling files — tested via e2e tests, not unit tests.
        // The formatters/ directory was split from the former output.ts monolith.
        'src/utils/formatters/migrations.ts',
        'src/utils/formatters/verify.ts',
        'src/utils/command-helpers.ts',
        // Error factory functions — just constructors
        'src/utils/cli-errors.ts',
        'src/utils/migration-types.ts',
        // Init / migration wiring — exercised by integration cli-journeys and fixture apps
        // (test/integration/test/cli-journeys/*.e2e.test.ts, cli.init-templates.e2e.test.ts)
        'src/commands/init/**',
        'src/migration-cli.ts',
        'src/utils/publish-contract-artifact-pair.ts',
        'src/utils/validate-contract-deps.ts',
        // Defensive error handling branches
        'src/load-ts-contract.ts',
        // Control API — tested via integration tests (test/integration/test/control-api.test.ts)
        'src/control-api/**',
      ],
      thresholds: {
        lines: 95,
        branches: 95,
        functions: 95,
        statements: 95,
      },
    },
  },
});
