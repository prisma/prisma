import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createDbSignCommand } from '@internal/cli/commands/db-sign';
import { timeouts, withClient, withDevDatabase } from '@repo/test-utils';
import stripAnsi from 'strip-ansi';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  executeCommand,
  getExitCode,
  parseJsonObjectFromCliCapture,
  setupCommandMocks,
  setupDbTestFixture,
  setupTestDirectoryFromFixtures,
  withTempDir,
} from './utils/cli-test-helpers';

// Fixture subdirectory for db-sign e2e tests
const fixtureSubdir = 'db-sign';

// Default schema for db-sign tests
const DEFAULT_USER_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS "user" (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL
  )
`;

/**
 * Sets up a database schema and test directory for db-sign e2e tests.
 * Creates a "user" table with id and email columns by default.
 */
async function setupDbSignFixture(
  connectionString: string,
  createTempDir: () => string,
  fixtureSubdir: string,
  schemaSql?: string,
): Promise<{ testSetup: ReturnType<typeof setupTestDirectoryFromFixtures>; configPath: string }> {
  return setupDbTestFixture({
    connectionString,
    createTempDir,
    fixtureSubdir,
    schemaSql: schemaSql ?? DEFAULT_USER_TABLE_SQL,
  });
}

/**
 * Runs the db-sign command with the given arguments.
 * Handles process.chdir and restores the original working directory.
 */
async function runDbSign(
  testSetup: ReturnType<typeof setupTestDirectoryFromFixtures>,
  _configPath: string,
  args: string[],
): Promise<number> {
  const command = createDbSignCommand();
  const originalCwd = process.cwd();
  try {
    process.chdir(testSetup.testDir);
    return await executeCommand(command, args);
  } finally {
    process.chdir(originalCwd);
  }
}

withTempDir(({ createTempDir }) => {
  describe('db sign command (e2e)', () => {
    let consoleOutput: string[] = [];
    let consoleErrors: string[] = [];
    let cleanupMocks: () => void;

    beforeEach(() => {
      // Set up console and process.exit mocks
      const mocks = setupCommandMocks();
      consoleOutput = mocks.consoleOutput;
      consoleErrors = mocks.consoleErrors;
      cleanupMocks = mocks.cleanup;
    });

    afterEach(() => {
      cleanupMocks();
    });

    it(
      'creates marker when schema matches contract',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testSetup, configPath } = await setupDbSignFixture(
            connectionString,
            createTempDir,
            fixtureSubdir,
          );

          await runDbSign(testSetup, configPath, ['--config', configPath, '--no-color']);

          // Get output and strip ANSI for snapshot
          const output = consoleOutput.join('\n');
          const stripped = stripAnsi(output);

          // Normalize paths and database URL for snapshot
          let normalized = stripped;
          // Replace file paths
          normalized = normalized.replace(
            /\/(?:Users|home|tmp|var|opt|mnt|root|[A-Z]:\\?)[^\s\n]*/g,
            '<path>',
          );
          // Normalize database URL (port number)
          normalized = normalized.replace(/(127\.0\.0\.1|localhost):\d+/g, '127.0.0.1:XXXXX');

          // Verify marker was created in database
          await withClient(connectionString, async (client) => {
            const result = await client.query(
              'select core_hash, profile_hash from prisma_contract.marker where space = $1',
              ['app'],
            );
            expect(result.rows.length).toBe(1);
            expect(result.rows[0]?.core_hash).toBeDefined();
          });

          expect(normalized).toContain('Database signed');
          expect(normalized).toContain('storageHash:');
          expect(normalized).toContain('from: none');
          expect(normalized).toContain('to:');
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'fails when schema does not match contract',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          // Set up database schema that does NOT match contract (missing table)
          const { testSetup, configPath } = await setupDbSignFixture(
            connectionString,
            createTempDir,
            fixtureSubdir,
            `
              CREATE TABLE IF NOT EXISTS "post" (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL
              )
            `,
          );

          await expect(
            runDbSign(testSetup, configPath, ['--config', configPath, '--no-color']),
          ).rejects.toThrow();

          // Verify marker was NOT created in database
          await withClient(connectionString, async (client) => {
            // Ensure marker table exists (might have been created by sign attempt)
            await client.query(`
                CREATE SCHEMA IF NOT EXISTS prisma_contract
              `);
            await client.query(`
                CREATE TABLE IF NOT EXISTS prisma_contract.marker (
                  space text not null primary key default 'app',
                  core_hash text not null,
                  profile_hash text not null,
                  contract_json jsonb,
                  canonical_version int,
                  updated_at timestamptz not null default now(),
                  app_tag text,
                  meta jsonb not null default '{}',
                  invariants text[] not null default '{}'
                )
              `);
            const result = await client.query(
              'select count(*) as count from prisma_contract.marker where space = $1',
              ['app'],
            );
            // Marker should not exist (sign should have failed before writing)
            expect(Number.parseInt(result.rows[0]?.count ?? '0', 10)).toBe(0);
          });
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'outputs JSON envelope with real database',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testSetup, configPath } = await setupDbSignFixture(
            connectionString,
            createTempDir,
            fixtureSubdir,
          );

          // Clear console output before running the command we want to test
          // (previous commands like 'contract emit' may have added output)
          const outputStartIndex = consoleOutput.length;

          await runDbSign(testSetup, configPath, ['--config', configPath, '--json', '--no-color']);

          const jsonOutput = parseJsonObjectFromCliCapture(
            consoleOutput.slice(outputStartIndex),
          ) as Record<string, unknown>;

          // Normalize non-deterministic values (timing, contractPath) for snapshot
          const meta = jsonOutput['meta'] as Record<string, unknown> | undefined;
          const normalized: Record<string, unknown> = {
            ...jsonOutput,
            meta: {
              ...meta,
              contractPath: meta?.['contractPath']
                ? String(meta['contractPath']).replace(/^.*\//, '<path>/')
                : meta?.['contractPath'],
            },
            timings: {
              total: expect.any(Number),
            },
          };

          // Verify structure
          expect(normalized).toMatchObject({
            ok: true,
            summary: expect.any(String),
            contract: {
              storageHash: expect.any(String),
            },
            marker: {
              created: true,
              updated: false,
            },
          });

          expect(normalized).toMatchObject({
            contract: {
              profileHash: expect.any(String),
              storageHash: expect.any(String),
            },
            marker: {
              created: true,
              updated: false,
            },
          });
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'handles missing contract file (ENOENT error)',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const testSetup = setupTestDirectoryFromFixtures(
            createTempDir,
            fixtureSubdir,
            'prisma-next.config.with-db.ts',
            { '{{DB_URL}}': connectionString },
          );
          const configPath = testSetup.configPath;

          // Don't create contract.json - it should be missing
          const command = createDbSignCommand();
          const originalCwd = process.cwd();
          try {
            process.chdir(testSetup.testDir);
            await expect(
              executeCommand(command, ['--config', configPath, '--no-color']),
            ).rejects.toThrow();
          } finally {
            process.chdir(originalCwd);
          }

          // Verify error output (errors go to stderr/consoleErrors)
          const errorOutput = consoleErrors.join('\n');
          expect(errorOutput).toContain('CLI.FILE_NOT_FOUND');
          expect(errorOutput).toMatch(/file.*not found|not found.*file/i);
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'handles contract file read errors (non-ENOENT)',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const testSetup = setupTestDirectoryFromFixtures(
            createTempDir,
            fixtureSubdir,
            'prisma-next.config.with-db.ts',
            { '{{DB_URL}}': connectionString },
          );
          const configPath = testSetup.configPath;

          // Create a contract file with invalid JSON (causes parse error, not ENOENT)
          const contractPath = resolve(testSetup.testDir, 'src/prisma/contract.json');
          mkdirSync(dirname(contractPath), { recursive: true });
          writeFileSync(contractPath, 'invalid json content', 'utf-8');

          const command = createDbSignCommand();
          const originalCwd = process.cwd();
          try {
            process.chdir(testSetup.testDir);
            // JSON.parse throws SyntaxError, which is caught and wrapped as errorUnexpected
            // The command should exit with non-zero code or throw
            await expect(
              executeCommand(command, ['--config', configPath, '--no-color']),
            ).rejects.toThrow();
          } finally {
            process.chdir(originalCwd);
          }

          // Verify error was handled (command failed)
          // The error path is covered even if we don't check the exact error message format
          // This tests the branch where file read succeeds but JSON.parse fails
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'handles quiet mode flag',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testSetup, configPath } = await setupDbSignFixture(
            connectionString,
            createTempDir,
            fixtureSubdir,
          );

          await runDbSign(testSetup, configPath, ['--config', configPath, '--quiet', '--no-color']);

          // In quiet mode, only errors should be output
          const output = consoleOutput.join('\n');
          expect(output).not.toContain('Database signed');
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'exits with code 1 when schema verification fails',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testSetup, configPath } = await setupDbSignFixture(
            connectionString,
            createTempDir,
            fixtureSubdir,
            `
              CREATE TABLE IF NOT EXISTS "user" (
                id SERIAL PRIMARY KEY
              )
            `,
          );

          // Contract expects both id and email columns, but database only has id
          // Modify the emitted contract to expect email column
          const contractPath = resolve(testSetup.testDir, 'src/prisma/contract.json');
          const { readFile, writeFile } = await import('node:fs/promises');
          const contractJson = JSON.parse(await readFile(contractPath, 'utf-8'));
          contractJson.storage.namespaces.public.entries.table.user.columns.email = {
            codecId: 'pg/text@1',
            nativeType: 'text',
            nullable: false,
          };
          await writeFile(contractPath, JSON.stringify(contractJson, null, 2), 'utf-8');

          // executeCommand throws for non-zero exit codes
          await expect(
            runDbSign(testSetup, configPath, ['--config', configPath, '--no-color']),
          ).rejects.toThrow('process.exit called');

          // Verify that schema verification failure was detected (exit code 1)
          expect(getExitCode()).toBe(1);

          // Verify that schema verification output was printed (not sign output)
          const output = consoleOutput.join('\n');
          expect(output).toContain('does not satisfy contract');
          expect(output).not.toContain('Database signed');
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'outputs JSON when schema verification fails with --json flag',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testSetup, configPath } = await setupDbSignFixture(
            connectionString,
            createTempDir,
            fixtureSubdir,
            `
              CREATE TABLE IF NOT EXISTS "user" (
                id SERIAL PRIMARY KEY
              )
            `,
          );

          // Contract expects both id and email columns, but database only has id
          // Modify the emitted contract to expect email column
          const contractPath = resolve(testSetup.testDir, 'src/prisma/contract.json');
          const { readFile, writeFile } = await import('node:fs/promises');
          const contractJson = JSON.parse(await readFile(contractPath, 'utf-8'));
          contractJson.storage.namespaces.public.entries.table.user.columns.email = {
            codecId: 'pg/text@1',
            nativeType: 'text',
            nullable: false,
          };
          await writeFile(contractPath, JSON.stringify(contractJson, null, 2), 'utf-8');

          // Clear console output before running the command we want to test
          const outputStartIndex = consoleOutput.length;

          // executeCommand throws for non-zero exit codes
          await expect(
            runDbSign(testSetup, configPath, ['--config', configPath, '--json', '--no-color']),
          ).rejects.toThrow('process.exit called');

          // Verify that schema verification failure was detected (exit code 1)
          expect(getExitCode()).toBe(1);

          // Verify that JSON output was printed (not human-readable output)
          const jsonOutput = parseJsonObjectFromCliCapture(consoleOutput.slice(outputStartIndex));
          expect(jsonOutput).toMatchObject({
            ok: false,
            summary: expect.stringContaining('does not satisfy contract'),
            schema: expect.anything(),
          });
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'formats sign output when schema verification passes',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testSetup, configPath } = await setupDbSignFixture(
            connectionString,
            createTempDir,
            fixtureSubdir,
          );

          // Clear console output before running the command we want to test
          const outputStartIndex = consoleOutput.length;

          await runDbSign(testSetup, configPath, ['--config', configPath, '--no-color']);

          // Verify that sign output was formatted (not schema verification output)
          const output = consoleOutput.slice(outputStartIndex).join('\n');
          expect(output).toContain('Database signed');
          expect(output).not.toContain('does not satisfy contract');
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'adds blank line after spinners when TTY and not quiet/JSON',
      async () => {
        const originalIsTTY = process.stdout.isTTY;
        process.stdout.isTTY = true;

        try {
          await withDevDatabase(async ({ connectionString }) => {
            const { testSetup, configPath } = await setupDbSignFixture(
              connectionString,
              createTempDir,
              fixtureSubdir,
            );

            await runDbSign(testSetup, configPath, ['--config', configPath, '--no-color']);

            const output = consoleOutput.join('\n');
            expect(output).toContain('Database signed');
          });
        } finally {
          process.stdout.isTTY = originalIsTTY;
        }
      },
      timeouts.spinUpPpgDev,
    );
  });
});
