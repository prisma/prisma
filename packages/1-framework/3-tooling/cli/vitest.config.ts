import { timeouts } from '@repo/test-utils';
import { defineConfig } from 'vitest/config';

/**
 * `control-api/client.test.ts` and `control-api/contract-emit.test.ts` both
 * `vi.mock('@internal/emitter')` and then configure the shared mock instance in
 * their own `beforeEach`. Under `isolate: false` every file shares one module
 * registry, so whichever of the two runs first supplies the module both of them
 * see: the other gets a mock it never configured, the real `emit` runs, and it
 * fails with `Cannot destructure property 'storageHash' of 'contract.storage'`.
 * File order decides who loses, which is why it read as a flake locally and as a
 * fixed failure on CI's ordering.
 *
 * These two get their own isolated project, so they no longer share a registry
 * with each other. Isolating the whole package fixes it too but costs ~4x (8s →
 * 33s); this leaves the other 113 files sharing one registry and runs in the
 * same time as before.
 */
const COLLIDING_MOCK_FILES = [
  'test/control-api/client.test.ts',
  'test/control-api/contract-emit.test.ts',
];

const shared = {
  globals: true,
  environment: 'node' as const,
  // Note: do not change to 'threads', it will cause the failure
  // `TypeError: process.chdir() is not supported in workers`.
  pool: 'forks' as const,
  maxWorkers: 1,
  fileParallelism: false,
  sequence: { groupOrder: 1 },
  testTimeout: timeouts.vitestPackageDefault,
  hookTimeout: timeouts.vitestPackageDefault,
  setupFiles: ['./test/setup.ts'],
  env: {
    CI: 'true',
    NO_COLOR: '1',
  },
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          ...shared,
          name: 'cli',
          exclude: ['**/node_modules/**', '**/dist/**', ...COLLIDING_MOCK_FILES],
          isolate: false,
        },
      },
      {
        test: {
          ...shared,
          name: 'cli-isolated-mocks',
          include: COLLIDING_MOCK_FILES,
          isolate: true,
        },
      },
    ],
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
