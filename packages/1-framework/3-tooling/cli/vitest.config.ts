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
        'src/cli.ts',
        // Formatting/wrangling files — tested via e2e tests, not unit tests.
        // The formatters/ directory was split from the former output.ts monolith.
        'src/utils/formatters/emit.ts',
        'src/utils/formatters/errors.ts',
        'src/utils/formatters/help.ts',
        'src/utils/formatters/migrations.ts',
        'src/utils/formatters/styled.ts',
        'src/utils/formatters/verify.ts',
        'src/utils/command-helpers.ts',
        'src/utils/global-flags.ts',
        'src/utils/terminal-ui.ts',
        'src/utils/shutdown.ts',
        // Command files — Commander.js setup and delegation to family instance,
        // tested via e2e tests in integration-tests (test/integration/test/cli.*.e2e.test.ts)
        'src/commands/contract-emit.ts',
        'src/commands/db-init.ts',
        'src/commands/db-introspect.ts',
        'src/commands/db-sign.ts',
        'src/commands/db-update.ts',
        'src/commands/db-verify.ts',
        'src/commands/migrate.ts',
        'src/commands/migration-plan.ts',
        'src/commands/migration-show.ts',
        'src/commands/migration-status.ts',
        'src/commands/ref.ts',
        // Error factory functions — just constructors
        'src/utils/cli-errors.ts',
        // Spinner and progress utilities — UI/UX code
        'src/utils/spinner.ts',
        'src/utils/progress-adapter.ts',
        // Migration command scaffold — orchestration code tested via e2e tests
        'src/utils/migration-command-scaffold.ts',
        'src/utils/migration-types.ts',
        // Init / migration wiring — exercised by integration cli-journeys and fixture apps
        // (test/integration/test/cli-journeys/*.e2e.test.ts, cli.init-templates.e2e.test.ts)
        'src/commands/init/**',
        'src/commands/migration-new.ts',
        'src/migration-cli.ts',
        'src/utils/publish-contract-artifact-pair.ts',
        'src/utils/validate-contract-deps.ts',
        // Defensive error handling branches
        'src/api/emit-contract.ts',
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
