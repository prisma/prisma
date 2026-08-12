import { timeouts, withDevDatabase } from '@repo/test-utils';
import stripAnsi from 'strip-ansi';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  setupCommandMocks,
  setupTestDirectoryFromFixtures,
  withTempDir,
} from './utils/cli-test-helpers';
import { runDbInit, setupDbInitFixture } from './utils/db-init-test-helpers';

const fixtureSubdir = 'db-init';

withTempDir(({ createTempDir }) => {
  describe('db init command (e2e) - errors', () => {
    let cleanupMocks: () => void;

    beforeEach(() => {
      const mocks = setupCommandMocks();
      cleanupMocks = mocks.cleanup;
    });

    afterEach(() => {
      cleanupMocks();
    });

    describe('error handling', () => {
      it(
        'handles missing contract file',
        async () => {
          await withDevDatabase(async ({ connectionString }) => {
            const testSetup = setupTestDirectoryFromFixtures(
              createTempDir,
              fixtureSubdir,
              'prisma-next.config.with-db.ts',
              { '{{DB_URL}}': connectionString },
            );
            const configPath = testSetup.configPath;

            const run = await runDbInit(testSetup, [
              '--config',
              configPath,
              '--json',
              '--no-color',
            ]);
            expect(run.exitCode).toBe(2);

            const errorJson = run.document as {
              code: string;
              nextActions: readonly { label: string }[];
            };
            expect(errorJson).toMatchObject({ code: 'CLI.FILE_NOT_FOUND' });
            expect(errorJson.nextActions.map((action) => action.label).join('\n')).toContain(
              'contract emit',
            );
          });
        },
        timeouts.spinUpPpgDev,
      );

      it(
        'handles quiet mode flag',
        async () => {
          await withDevDatabase(async ({ connectionString }) => {
            const { testSetup, configPath } = await setupDbInitFixture(
              connectionString,
              createTempDir,
              fixtureSubdir,
            );

            const run = await runDbInit(testSetup, [
              '--config',
              configPath,
              '--quiet',
              '--no-color',
            ]);

            expect(stripAnsi(run.stderr)).not.toContain('Bootstrap');
          });
        },
        timeouts.spinUpPpgDev,
      );
    });

    describe('connect failure', () => {
      it(
        'returns structured error with --json',
        async () => {
          await withDevDatabase(async ({ connectionString }) => {
            const { testSetup, configPath } = await setupDbInitFixture(
              connectionString,
              createTempDir,
              fixtureSubdir,
            );

            const badUrl = (() => {
              const url = new URL(connectionString);
              url.port = '1';
              return url.toString();
            })();

            const run = await runDbInit(testSetup, [
              '--config',
              configPath,
              '--db',
              badUrl,
              '--json',
              '--no-color',
            ]);
            expect(run.exitCode).toBe(2);

            const errorJson = run.document as Record<string, unknown>;

            expect(errorJson).toMatchObject({
              code: 'DRIVER.CONNECTION_FAILED',
              summary: 'Database connection failed',
              meta: {
                port: '1',
              },
            });

            expect(errorJson).not.toHaveProperty('meta.password');
          });
        },
        timeouts.spinUpPpgDev,
      );
    });
  });
});
