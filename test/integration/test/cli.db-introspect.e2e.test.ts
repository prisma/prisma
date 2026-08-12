import { existsSync, readFileSync } from 'node:fs';
import { createContractInferCommand } from '@internal/cli/commands/contract-infer';
import { createDbSchemaCommand } from '@internal/cli/commands/db-schema';
import { timeouts, withClient, withDevDatabase } from '@repo/test-utils';
import { join } from 'pathe';
import stripAnsi from 'strip-ansi';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  executeCommand,
  parseJsonObjectFromCliCapture,
  setupCommandMocks,
  setupTestDirectoryFromFixtures,
  withTempDir,
} from './utils/cli-test-helpers';

const fixtureSubdir = 'db-introspect';

function stdoutOnly(consoleOutput: string[], consoleErrors: string[]): string[] {
  const stderrBag = [...consoleErrors];
  return consoleOutput.filter((line) => {
    const idx = stderrBag.indexOf(line);
    if (idx !== -1) {
      stderrBag.splice(idx, 1);
      return false;
    }
    return true;
  });
}

function normalizeOutput(stripped: string): string {
  return stripped
    .replace(/127\.0\.0\.1:\d+/g, '127.0.0.1:XXXXX')
    .replace(/\(\d+ms\)/g, '(Xms)')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (/^[◒◐◓◑]/.test(trimmed)) return false;
      if (/^◇/.test(trimmed)) return false;
      if (trimmed === '│') return false;
      if (/^\(node:\d+\)/.test(trimmed)) return false;
      if (/^\(Use `node --trace-warnings/.test(trimmed)) return false;
      if (trimmed.includes('ExperimentalWarning:')) return false;
      if (/^\[\d{4}-\d{2}-\d{2}T/.test(trimmed) && trimmed.includes('[ERROR]')) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

withTempDir(({ createTempDir }) => {
  describe('live schema CLI commands (e2e)', () => {
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

    describe('db schema', () => {
      it(
        'prints the live schema tree without writing files',
        async () => {
          await withDevDatabase(async ({ connectionString }) => {
            await withClient(connectionString, async (client) => {
              await client.query(`
                CREATE TABLE IF NOT EXISTS "user" (
                  id SERIAL PRIMARY KEY,
                  email TEXT NOT NULL,
                  name TEXT
                )
              `);
              await client.query(`
                CREATE TABLE IF NOT EXISTS "post" (
                  id SERIAL PRIMARY KEY,
                  title TEXT NOT NULL,
                  "userId" INTEGER REFERENCES "user"(id)
                )
              `);
              await client.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique" ON "user"(email)
              `);
            });

            const testSetup = setupTestDirectoryFromFixtures(
              createTempDir,
              fixtureSubdir,
              'prisma-next.config.with-db.ts',
              { '{{DB_URL}}': connectionString },
            );

            const command = createDbSchemaCommand();
            const originalCwd = process.cwd();
            try {
              process.chdir(testSetup.testDir);
              await executeCommand(command, ['--config', testSetup.configPath, '--no-color']);
            } finally {
              process.chdir(originalCwd);
            }

            expect(existsSync(join(testSetup.testDir, 'output/contract.prisma'))).toBe(false);

            const output = consoleOutput.join('\n');
            const normalized = normalizeOutput(stripAnsi(output));
            expect(normalized).toMatchSnapshot();
          });
        },
        timeouts.spinUpPpgDev,
      );

      it(
        '--json prints raw schema output without writing files',
        async () => {
          await withDevDatabase(async ({ connectionString }) => {
            await withClient(connectionString, async (client) => {
              await client.query(`
                CREATE TABLE IF NOT EXISTS "simple" (
                  id SERIAL PRIMARY KEY
                )
              `);
            });

            const testSetup = setupTestDirectoryFromFixtures(
              createTempDir,
              fixtureSubdir,
              'prisma-next.config.with-db.ts',
              { '{{DB_URL}}': connectionString },
            );

            const command = createDbSchemaCommand();
            const originalCwd = process.cwd();
            try {
              process.chdir(testSetup.testDir);
              await executeCommand(command, [
                '--config',
                testSetup.configPath,
                '--json',
                '--no-color',
              ]);
            } finally {
              process.chdir(originalCwd);
            }

            expect(existsSync(join(testSetup.testDir, 'output/contract.prisma'))).toBe(false);

            const jsonOutput = parseJsonObjectFromCliCapture(
              stdoutOnly(consoleOutput, consoleErrors),
            ) as { ok: boolean; summary: string; schema: unknown };
            expect(jsonOutput).toMatchObject({
              ok: true,
              summary: 'Schema read successfully',
              schema: expect.any(Object),
            });
          });
        },
        timeouts.spinUpPpgDev,
      );
    });

    describe('contract infer', () => {
      it(
        'writes a full PSL snapshot to output/contract.prisma',
        async () => {
          await withDevDatabase(async ({ connectionString }) => {
            await withClient(connectionString, async (client) => {
              await client.query(`
                CREATE TABLE IF NOT EXISTS "user" (
                  id SERIAL PRIMARY KEY,
                  email TEXT NOT NULL,
                  name TEXT
                )
              `);
            });

            const testSetup = setupTestDirectoryFromFixtures(
              createTempDir,
              fixtureSubdir,
              'prisma-next.config.with-db.ts',
              { '{{DB_URL}}': connectionString },
            );

            const command = createContractInferCommand();
            const originalCwd = process.cwd();
            try {
              process.chdir(testSetup.testDir);
              await executeCommand(command, ['--config', testSetup.configPath, '--no-color']);
            } finally {
              process.chdir(originalCwd);
            }

            const pslPath = join(testSetup.testDir, 'output/contract.prisma');
            expect(existsSync(pslPath)).toBe(true);
            expect(readFileSync(pslPath, 'utf-8')).toMatchSnapshot();

            const stderrOutput = stripAnsi(consoleErrors.join('\n'));
            expect(stderrOutput).toContain('Contract written to output/contract.prisma');
          });
        },
        timeouts.spinUpPpgDev,
      );

      it(
        '--json includes the inferred PSL path',
        async () => {
          await withDevDatabase(async ({ connectionString }) => {
            await withClient(connectionString, async (client) => {
              await client.query(`
                CREATE TABLE IF NOT EXISTS "user" (
                  id SERIAL PRIMARY KEY,
                  email TEXT NOT NULL
                )
              `);
            });

            const testSetup = setupTestDirectoryFromFixtures(
              createTempDir,
              fixtureSubdir,
              'prisma-next.config.with-db.ts',
              { '{{DB_URL}}': connectionString },
            );

            const command = createContractInferCommand();
            const originalCwd = process.cwd();
            try {
              process.chdir(testSetup.testDir);
              await executeCommand(command, [
                '--config',
                testSetup.configPath,
                '--json',
                '--no-color',
              ]);
            } finally {
              process.chdir(originalCwd);
            }

            const jsonOutput = parseJsonObjectFromCliCapture(
              stdoutOnly(consoleOutput, consoleErrors),
            ) as { ok: boolean; summary: string; psl: { path: string } };
            expect(jsonOutput).toMatchObject({
              ok: true,
              summary: 'Contract inferred successfully',
              psl: { path: 'output/contract.prisma' },
            });
          });
        },
        timeouts.spinUpPpgDev,
      );
    });
  });
});
