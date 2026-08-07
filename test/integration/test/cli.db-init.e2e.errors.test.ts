import { timeouts, withDevDatabase } from '@repo/test-utils';
import stripAnsi from 'strip-ansi';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  parseJsonObjectFromCliCapture,
  setupCommandMocks,
  setupTestDirectoryFromFixtures,
  withTempDir,
} from './utils/cli-test-helpers';
import { runDbInit, setupDbInitFixture } from './utils/db-init-test-helpers';

const fixtureSubdir = 'db-init';

withTempDir(({ createTempDir }) => {
  describe('db init command (e2e) - errors', () => {
    let consoleOutput: string[] = [];
    let consoleErrors: string[] = [];
    let cleanupMocks: () => void;

    beforeEach(() => {
      const mocks = setupCommandMocks();
      consoleOutput = mocks.consoleOutput;
      consoleErrors = mocks.consoleErrors;
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

            await expect(
              runDbInit(testSetup, ['--config', configPath, '--json', '--no-color']),
            ).rejects.toThrow();

            const errorJson = parseJsonObjectFromCliCapture(consoleOutput) as Record<
              string,
              unknown
            >;
            expect(errorJson).toMatchObject({
              code: 'CLI.FILE_NOT_FOUND',
            });
            expect(String(errorJson['fix'])).toContain('contract emit');
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

            await runDbInit(testSetup, ['--config', configPath, '--quiet', '--no-color']);

            const output = stripAnsi(consoleOutput.join('\n'));
            expect(output).not.toContain('Bootstrap');
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

            consoleOutput.length = 0;
            consoleErrors.length = 0;

            await expect(
              runDbInit(testSetup, [
                '--config',
                configPath,
                '--db',
                badUrl,
                '--json',
                '--no-color',
              ]),
            ).rejects.toThrow();

            const errorJson = parseJsonObjectFromCliCapture(consoleOutput) as Record<
              string,
              unknown
            >;

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
