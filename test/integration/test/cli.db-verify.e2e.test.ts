import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { createContractEmitCommand } from '@internal/cli/commands/contract-emit';
import { createDbVerifyCommand } from '@internal/cli/commands/db-verify';
import type { Contract } from '@internal/contract/types';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import type { SqlStorage } from '@internal/sql-contract/types';
import { typescriptContract } from '@internal/sql-contract-ts/config-types';
import { seedTestMarker } from '@internal/sql-runtime/test/utils';
import { ok } from '@internal/utils/result';
import { timeouts, withClient, withDevDatabase } from '@repo/test-utils';
import { join, resolve } from 'pathe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapPostgresSignMarkerTables } from './postgres-bootstrap';
import {
  executeCommand,
  getExitCode,
  loadContractFromDisk,
  setupCommandMocks,
  setupTestDirectoryFromFixtures,
  withTempDir,
} from './utils/cli-test-helpers';

vi.mock('@internal/config-loader', { spy: true });

// Fixture subdirectory for db-verify tests
const fixtureSubdir = 'db-verify';

function createTestContract(
  tables: Record<
    string,
    {
      columns: Record<string, { codecId: string; nativeType: string; nullable: boolean }>;
      uniques?: Array<{ columns: string[] }>;
    }
  >,
) {
  return {
    schemaVersion: '1',
    target: 'postgres',
    targetFamily: 'sql',
    storage: {
      storageHash: 'test',
      namespaces: {
        [UNBOUND_NAMESPACE_ID]: {
          id: UNBOUND_NAMESPACE_ID,
          kind: 'postgres-schema',
          entries: {
            table: Object.fromEntries(
              Object.entries(tables).map(([name, { columns, uniques = [] }]) => [
                name,
                {
                  columns,
                  primaryKey: { columns: ['id'] },
                  uniques,
                  indexes: [],
                  foreignKeys: [],
                },
              ]),
            ),
          },
        },
      },
    },
    roots: {},
    domain: {
      namespaces: {
        [UNBOUND_NAMESPACE_ID]: {
          models: Object.fromEntries(
            Object.entries(tables).map(([name, { columns }]) => [
              name,
              {
                storage: {
                  namespaceId: UNBOUND_NAMESPACE_ID,
                  table: name,
                  fields: Object.fromEntries(
                    Object.keys(columns).map((col) => [col, { column: col }]),
                  ),
                },
                fields: Object.fromEntries(
                  Object.entries(columns).map(([col, spec]) => [
                    col,
                    {
                      nullable: spec.nullable,
                      type: { kind: 'scalar' as const, codecId: spec.codecId },
                    },
                  ]),
                ),
                relations: {},
              },
            ]),
          ),
        },
      },
    },
    extensions: {},
    capabilities: {},
    meta: {},
    profileHash: 'test',
  };
}

/**
 * Extracts JSON from mixed output that may contain Clack decoration lines.
 * Finds the outermost `{ ... }` block in the joined output.
 */
function extractJson(lines: string[]): unknown {
  const joined = lines.join('\n');
  const start = joined.indexOf('{');
  const end = joined.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`No JSON object found in output:\n${joined}`);
  }
  return JSON.parse(joined.slice(start, end + 1));
}

async function writeMatchingMarker(
  connectionString: string,
  contract: Contract<SqlStorage>,
): Promise<void> {
  await withClient(connectionString, async (client) => {
    await bootstrapPostgresSignMarkerTables(client);

    await seedTestMarker(client, {
      storageHash: contract.storage.storageHash,
      profileHash: contract.profileHash ?? contract.storage.storageHash,
      contractJson: contract,
      canonicalVersion: 1,
    });
  });
}

async function createMatchingSchemaAndMarker(
  connectionString: string,
  contract: Contract<SqlStorage>,
): Promise<void> {
  await withClient(connectionString, async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "user" (
        id integer NOT NULL,
        email text NOT NULL,
        PRIMARY KEY ("id")
      )
    `);
  });

  await writeMatchingMarker(connectionString, contract);
}

withTempDir(({ createTempDir }) => {
  describe('db verify command (e2e)', () => {
    let consoleOutput: string[] = [];
    let cleanupMocks: () => void;

    beforeEach(() => {
      // Set up console and process.exit mocks
      const mocks = setupCommandMocks();
      consoleOutput = mocks.consoleOutput;
      cleanupMocks = mocks.cleanup;
    });

    afterEach(() => {
      cleanupMocks();
    });

    it(
      'verifies database with matching marker via driver',
      async () => {
        await withDevDatabase(
          async ({ connectionString }) => {
            // Set up test directory from fixtures with db config
            const testSetup = setupTestDirectoryFromFixtures(
              createTempDir,
              fixtureSubdir,
              'prisma-next.config.with-db.ts',
              { '{{DB_URL}}': connectionString },
            );
            const testDir = testSetup.testDir;
            const configPath = testSetup.configPath;

            // Emit contract first
            const emitCommand = createContractEmitCommand();
            const originalCwd = process.cwd();
            try {
              process.chdir(testDir);
              await executeCommand(emitCommand, ['--config', configPath, '--no-color']);
            } finally {
              process.chdir(originalCwd);
            }

            // Load precomputed contract from disk
            const contractJsonPath = join(testDir, 'output', 'contract.json');
            const contract = loadContractFromDisk<Contract<SqlStorage>>(contractJsonPath);

            await createMatchingSchemaAndMarker(connectionString, contract);

            // Clear console output before running the command we want to test
            // (previous commands like 'contract emit' may have added output)
            const outputStartIndex = consoleOutput.length;

            const command = createDbVerifyCommand();
            const verifyCwd = process.cwd();
            try {
              process.chdir(testDir);
              await executeCommand(command, ['--config', configPath, '--json']);
            } finally {
              process.chdir(verifyCwd);
            }

            // Check exit code is 0 (success)
            const exitCode = getExitCode();
            expect(exitCode).toBe(0);

            // Parse and verify JSON output (only from this command).
            // consoleOutput may contain Clack decoration from stderr; extract the JSON block.
            const parsed = extractJson(consoleOutput.slice(outputStartIndex)) as Record<
              string,
              unknown
            >;
            expect(parsed).toMatchObject({
              ok: true,
              mode: 'full',
              summary: expect.any(String),
              contract: {
                storageHash: expect.any(String),
              },
              marker: {
                storageHash: expect.any(String),
              },
              target: {
                expected: expect.any(String),
              },
              schema: {
                summary: expect.any(String),
                strict: expect.any(Boolean),
              },
            });

            // Verify storageHash matches
            expect((parsed['contract'] as { storageHash: string }).storageHash).toBe(
              contract.storage.storageHash,
            );
            expect((parsed['marker'] as { storageHash: string }).storageHash).toBe(
              contract.storage.storageHash,
            );
          },
          // Use random ports to avoid conflicts in CI (no options = random ports)
          {},
        );
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'exits with code 1 when marker matches but schema verification fails',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const testSetup = setupTestDirectoryFromFixtures(
            createTempDir,
            fixtureSubdir,
            'prisma-next.config.with-db.ts',
            { '{{DB_URL}}': connectionString },
          );
          const testDir = testSetup.testDir;
          const configPath = testSetup.configPath;

          const emitCommand = createContractEmitCommand();
          const originalCwd = process.cwd();
          try {
            process.chdir(testDir);
            await executeCommand(emitCommand, ['--config', configPath, '--no-color']);
          } finally {
            process.chdir(originalCwd);
          }

          const contractJsonPath = join(testDir, 'output', 'contract.json');
          const contract = loadContractFromDisk<Contract<SqlStorage>>(contractJsonPath);
          await writeMatchingMarker(connectionString, contract);

          const outputStartIndex = consoleOutput.length;

          const command = createDbVerifyCommand();
          const verifyCwd = process.cwd();
          try {
            process.chdir(testDir);
            await expect(
              executeCommand(command, ['--config', configPath, '--json']),
            ).rejects.toThrow('process.exit called');
          } finally {
            process.chdir(verifyCwd);
          }

          expect(getExitCode()).toBe(1);

          const parsed = extractJson(consoleOutput.slice(outputStartIndex)) as Record<
            string,
            unknown
          >;
          expect(parsed).toMatchObject({
            ok: false,
            summary: expect.stringContaining('does not satisfy contract'),
            schema: expect.anything(),
          });
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'reports error when marker is missing via driver',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          // Set up test directory from fixtures with db config
          const testSetup = setupTestDirectoryFromFixtures(
            createTempDir,
            fixtureSubdir,
            'prisma-next.config.with-db.ts',
            { '{{DB_URL}}': connectionString },
          );
          const testDir = testSetup.testDir;
          const configPath = testSetup.configPath;

          // Emit contract first
          const emitCommand = createContractEmitCommand();
          const emitCwd1 = process.cwd();
          try {
            process.chdir(testDir);
            await executeCommand(emitCommand, ['--config', configPath, '--no-color']);
          } finally {
            process.chdir(emitCwd1);
          }

          await withClient(connectionString, async (client) => {
            // Setup marker schema and table but don't write marker
            await bootstrapPostgresSignMarkerTables(client);
            // withClient will close the client after this callback returns
          });

          // Load precomputed contract from disk
          const contractJsonPath = join(testDir, 'output', 'contract.json');
          loadContractFromDisk<Contract<SqlStorage>>(contractJsonPath);

          // Clear console output before running the command we want to test
          // (previous commands like 'contract emit' may have added output)
          const outputStartIndex = consoleOutput.length;

          const command = createDbVerifyCommand();
          const verifyCwd1 = process.cwd();
          try {
            process.chdir(testDir);
            await expect(
              executeCommand(command, ['--config', configPath, '--json']),
            ).rejects.toThrow('process.exit called');
          } finally {
            process.chdir(verifyCwd1);
          }

          // Check exit code is non-zero (error)
          const exitCode = getExitCode();
          expect(exitCode).not.toBe(0);

          // Parse only the db verify output (skip earlier contract emit output).
          const parsed = extractJson(consoleOutput.slice(outputStartIndex)) as Record<
            string,
            unknown
          >;
          expect(parsed).toMatchObject({
            code: 'CONTRACT.MARKER_MISSING',
            summary: expect.any(String),
            why: expect.any(String),
            fix: expect.any(String),
          });
          expect(parsed['summary']).toContain('Database not signed');
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'runs schema-only verification with matching schema via driver',
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
          const configPath = testSetup.configPath;
          const contractJson = createTestContract({
            user: {
              columns: {
                id: { codecId: 'pg/int4@1', nativeType: 'int4', nullable: false },
                email: { codecId: 'pg/text@1', nativeType: 'text', nullable: false },
              },
            },
          });
          const contractPath = resolve(testSetup.testDir, 'output/contract.json');
          mkdirSync(resolve(testSetup.testDir, 'output'), { recursive: true });
          writeFileSync(contractPath, JSON.stringify(contractJson, null, 2), 'utf-8');

          const outputStartIndex = consoleOutput.length;
          const command = createDbVerifyCommand();
          const verifyCwd = process.cwd();
          try {
            process.chdir(testSetup.testDir);
            await executeCommand(command, [
              '--config',
              configPath,
              '--schema-only',
              '--json',
              '--no-color',
            ]);
          } finally {
            process.chdir(verifyCwd);
          }

          expect(getExitCode()).toBe(0);

          const parsed = extractJson(consoleOutput.slice(outputStartIndex)) as Record<
            string,
            unknown
          >;
          expect(parsed).toMatchObject({
            ok: true,
            summary: expect.stringContaining('satisfies contract'),
            schema: expect.anything(),
            meta: {
              strict: false,
            },
          });
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'runs schema-only verification when marker is missing',
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
          const configPath = testSetup.configPath;
          const contractJson = createTestContract({
            user: {
              columns: {
                id: { codecId: 'pg/int4@1', nativeType: 'int4', nullable: false },
                email: { codecId: 'pg/text@1', nativeType: 'text', nullable: false },
              },
            },
          });
          const contractPath = resolve(testSetup.testDir, 'output/contract.json');
          mkdirSync(resolve(testSetup.testDir, 'output'), { recursive: true });
          writeFileSync(contractPath, JSON.stringify(contractJson, null, 2), 'utf-8');

          const outputStartIndex = consoleOutput.length;
          const command = createDbVerifyCommand();
          const verifyCwd = process.cwd();
          try {
            process.chdir(testSetup.testDir);
            await executeCommand(command, [
              '--config',
              configPath,
              '--schema-only',
              '--json',
              '--no-color',
            ]);
          } finally {
            process.chdir(verifyCwd);
          }

          expect(getExitCode()).toBe(0);

          const parsed = extractJson(consoleOutput.slice(outputStartIndex)) as Record<
            string,
            unknown
          >;
          expect(parsed).toMatchObject({
            ok: true,
            summary: expect.stringContaining('satisfies contract'),
          });
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'prints schema-only failure diagnostics even under --quiet',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const testSetup = setupTestDirectoryFromFixtures(
            createTempDir,
            fixtureSubdir,
            'prisma-next.config.with-db.ts',
            { '{{DB_URL}}': connectionString },
          );
          const configPath = testSetup.configPath;
          // The contract expects a `user` table the database does not have, so
          // the schema-only verify fails.
          const contractJson = createTestContract({
            user: {
              columns: {
                id: { codecId: 'pg/int4@1', nativeType: 'int4', nullable: false },
              },
            },
          });
          const contractPath = resolve(testSetup.testDir, 'output/contract.json');
          mkdirSync(resolve(testSetup.testDir, 'output'), { recursive: true });
          writeFileSync(contractPath, JSON.stringify(contractJson, null, 2), 'utf-8');

          const outputStartIndex = consoleOutput.length;
          const command = createDbVerifyCommand();
          const verifyCwd = process.cwd();
          try {
            process.chdir(testSetup.testDir);
            await expect(
              executeCommand(command, [
                '--config',
                configPath,
                '--schema-only',
                '--quiet',
                '--no-color',
              ]),
            ).rejects.toThrow('process.exit called');
          } finally {
            process.chdir(verifyCwd);
          }

          expect(getExitCode()).toBe(1);

          // Exiting 1 without diagnostics is unhelpful: the failure render
          // overrides --quiet, same as the full-mode branch.
          const rendered = consoleOutput.slice(outputStartIndex).join('\n');
          expect(rendered).toContain('user');
          expect(rendered).toContain('does not satisfy contract');
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'passes schema-only strict verification when schema matches exactly',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          await withClient(connectionString, async (client) => {
            await client.query(`
              CREATE TABLE IF NOT EXISTS "user" (
                id integer NOT NULL,
                email text NOT NULL,
                PRIMARY KEY ("id")
              )
            `);
          });

          const testSetup = setupTestDirectoryFromFixtures(
            createTempDir,
            fixtureSubdir,
            'prisma-next.config.with-db.ts',
            { '{{DB_URL}}': connectionString },
          );
          const configPath = testSetup.configPath;
          const contractJson = createTestContract({
            user: {
              columns: {
                id: { codecId: 'pg/int4@1', nativeType: 'int4', nullable: false },
                email: { codecId: 'pg/text@1', nativeType: 'text', nullable: false },
              },
            },
          });
          const contractPath = resolve(testSetup.testDir, 'output/contract.json');
          mkdirSync(resolve(testSetup.testDir, 'output'), { recursive: true });
          writeFileSync(contractPath, JSON.stringify(contractJson, null, 2), 'utf-8');

          const outputStartIndex = consoleOutput.length;
          const command = createDbVerifyCommand();
          const verifyCwd = process.cwd();
          try {
            process.chdir(testSetup.testDir);
            await executeCommand(command, [
              '--config',
              configPath,
              '--schema-only',
              '--strict',
              '--json',
              '--no-color',
            ]);
          } finally {
            process.chdir(verifyCwd);
          }

          expect(getExitCode()).toBe(0);

          const parsed = extractJson(consoleOutput.slice(outputStartIndex)) as Record<
            string,
            unknown
          >;
          expect(parsed).toMatchObject({
            ok: true,
            summary: expect.stringContaining('satisfies contract'),
            schema: expect.anything(),
            meta: {
              strict: true,
            },
          });
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'preserves schema-only retry hint when database connection is missing',
      async () => {
        const testSetup = setupTestDirectoryFromFixtures(
          createTempDir,
          fixtureSubdir,
          'prisma-next.config.ts',
        );
        const testDir = testSetup.testDir;
        const configPath = testSetup.configPath;

        const emitCommand = createContractEmitCommand();
        const emitCwd = process.cwd();
        try {
          process.chdir(testDir);
          await executeCommand(emitCommand, ['--config', configPath, '--no-color']);
        } finally {
          process.chdir(emitCwd);
        }

        const outputStartIndex = consoleOutput.length;
        const command = createDbVerifyCommand();
        const verifyCwd = process.cwd();
        try {
          process.chdir(testDir);
          await expect(
            executeCommand(command, [
              '--config',
              configPath,
              '--schema-only',
              '--strict',
              '--json',
            ]),
          ).rejects.toThrow('process.exit called');
        } finally {
          process.chdir(verifyCwd);
        }

        expect(getExitCode()).not.toBe(0);

        const parsed = extractJson(consoleOutput.slice(outputStartIndex)) as Record<
          string,
          unknown
        >;
        expect(parsed).toMatchObject({
          code: 'CONFIG.DB_CONNECTION_REQUIRED',
          summary: 'Database connection is required',
        });
        expect(parsed['fix']).toContain(
          'Run `prisma-next db verify --schema-only --strict --db <url>`',
        );
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'fails in strict mode when extra columns exist',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const testSetup = setupTestDirectoryFromFixtures(
            createTempDir,
            fixtureSubdir,
            'prisma-next.config.with-db.ts',
            { '{{DB_URL}}': connectionString },
          );
          const testDir = testSetup.testDir;
          const configPath = testSetup.configPath;

          const emitCommand = createContractEmitCommand();
          const originalCwd = process.cwd();
          try {
            process.chdir(testDir);
            await executeCommand(emitCommand, ['--config', configPath, '--no-color']);
          } finally {
            process.chdir(originalCwd);
          }

          const contractJsonPath = join(testDir, 'output', 'contract.json');
          const contract = loadContractFromDisk<Contract<SqlStorage>>(contractJsonPath);

          await withClient(connectionString, async (client) => {
            await client.query(`
              CREATE TABLE IF NOT EXISTS "user" (
                id integer NOT NULL,
                email text NOT NULL,
                age integer,
                PRIMARY KEY ("id")
              )
            `);
          });
          await writeMatchingMarker(connectionString, contract);

          const outputStartIndex = consoleOutput.length;
          const command = createDbVerifyCommand();
          const verifyCwd = process.cwd();
          try {
            process.chdir(testDir);
            await expect(
              executeCommand(command, ['--config', configPath, '--json', '--strict']),
            ).rejects.toThrow('process.exit called');
          } finally {
            process.chdir(verifyCwd);
          }

          expect(getExitCode()).toBe(1);

          const parsed = extractJson(consoleOutput.slice(outputStartIndex)) as Record<
            string,
            unknown
          >;
          expect(parsed).toMatchObject({
            ok: false,
            summary: expect.stringContaining('does not satisfy contract'),
            meta: {
              strict: true,
            },
          });
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'outputs JSON in marker-only mode when --marker-only flag is provided',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          // Set up test directory from fixtures with db config
          const testSetup = setupTestDirectoryFromFixtures(
            createTempDir,
            fixtureSubdir,
            'prisma-next.config.with-db.ts',
            { '{{DB_URL}}': connectionString },
          );
          const testDir = testSetup.testDir;
          const configPath = testSetup.configPath;

          // Emit contract first
          const emitCommand = createContractEmitCommand();
          const originalCwd = process.cwd();
          try {
            process.chdir(testDir);
            await executeCommand(emitCommand, ['--config', configPath, '--no-color']);
          } finally {
            process.chdir(originalCwd);
          }

          // Load precomputed contract from disk
          const contractJsonPath = join(testDir, 'output', 'contract.json');
          const contract = loadContractFromDisk<Contract<SqlStorage>>(contractJsonPath);

          await writeMatchingMarker(connectionString, contract);

          // Clear console output before running the command we want to test
          // (previous commands like 'contract emit' may have added output)
          const outputStartIndex = consoleOutput.length;

          const command = createDbVerifyCommand();
          const verifyCwd2 = process.cwd();
          try {
            process.chdir(testDir);
            await executeCommand(command, ['--config', configPath, '--json', '--marker-only']);
          } finally {
            process.chdir(verifyCwd2);
          }

          // Check exit code is 0 (success)
          const exitCode = getExitCode();
          expect(exitCode).toBe(0);

          // Parse and verify JSON output (only from this command).
          // consoleOutput may contain Clack decoration from stderr; extract the JSON block.
          const parsed = extractJson(consoleOutput.slice(outputStartIndex)) as Record<
            string,
            unknown
          >;
          expect(parsed).toMatchObject({
            ok: true,
            mode: 'marker-only',
            summary: expect.any(String),
            contract: {
              storageHash: expect.any(String),
            },
            marker: {
              storageHash: expect.any(String),
            },
            target: {
              expected: expect.any(String),
            },
            meta: {
              contractPath: expect.any(String),
              schemaVerification: 'skipped',
            },
            timings: {
              total: expect.any(Number),
            },
            warning: expect.stringContaining('Schema verification skipped'),
          });
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'rejects mutually exclusive verify modes',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const testSetup = setupTestDirectoryFromFixtures(
            createTempDir,
            fixtureSubdir,
            'prisma-next.config.with-db.ts',
            { '{{DB_URL}}': connectionString },
          );
          const configPath = testSetup.configPath;

          const command = createDbVerifyCommand();
          const verifyCwd = process.cwd();
          try {
            process.chdir(testSetup.testDir);
            await expect(
              executeCommand(command, [
                '--config',
                configPath,
                '--json',
                '--marker-only',
                '--schema-only',
              ]),
            ).rejects.toThrow('process.exit called');
          } finally {
            process.chdir(verifyCwd);
          }

          expect(getExitCode()).toBe(2);

          const parsed = extractJson(consoleOutput) as Record<string, unknown>;
          expect(parsed).toMatchObject({
            code: 'CLI.INVALID_VERIFY_MODE',
            summary: 'Invalid verify mode',
          });
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'rejects strict mode when schema verification is skipped',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const testSetup = setupTestDirectoryFromFixtures(
            createTempDir,
            fixtureSubdir,
            'prisma-next.config.with-db.ts',
            { '{{DB_URL}}': connectionString },
          );
          const configPath = testSetup.configPath;

          const command = createDbVerifyCommand();
          const verifyCwd = process.cwd();
          try {
            process.chdir(testSetup.testDir);
            await expect(
              executeCommand(command, [
                '--config',
                configPath,
                '--json',
                '--marker-only',
                '--strict',
              ]),
            ).rejects.toThrow('process.exit called');
          } finally {
            process.chdir(verifyCwd);
          }

          expect(getExitCode()).toBe(2);

          const parsed = extractJson(consoleOutput) as Record<string, unknown>;
          expect(parsed).toMatchObject({
            code: 'CLI.INVALID_VERIFY_MODE',
            summary: 'Invalid verify mode',
          });
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'reports error with JSON when marker is missing and --json flag is provided via driver',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          // Set up test directory from fixtures with db config
          const testSetup = setupTestDirectoryFromFixtures(
            createTempDir,
            fixtureSubdir,
            'prisma-next.config.with-db.ts',
            { '{{DB_URL}}': connectionString },
          );
          const testDir = testSetup.testDir;
          const configPath = testSetup.configPath;

          // Emit contract first
          const emitCommand = createContractEmitCommand();
          const emitCwd2 = process.cwd();
          try {
            process.chdir(testDir);
            await executeCommand(emitCommand, ['--config', configPath, '--no-color']);
          } finally {
            process.chdir(emitCwd2);
          }

          await withClient(connectionString, async (client) => {
            // Setup marker schema and table but don't write marker
            await bootstrapPostgresSignMarkerTables(client);
            // withClient will close the client after this callback returns
          });

          // Load precomputed contract from disk
          const contractJsonPath = join(testDir, 'output', 'contract.json');
          const contract = loadContractFromDisk<Contract<SqlStorage>>(contractJsonPath);
          expect(contract).toBeDefined();
          expect(contract.storage.storageHash).toBeDefined();

          const command = createDbVerifyCommand();
          const verifyCwd4 = process.cwd();
          try {
            process.chdir(testDir);
            await expect(
              executeCommand(command, ['--config', configPath, '--json']),
            ).rejects.toThrow('process.exit called');
          } finally {
            process.chdir(verifyCwd4);
          }

          // Check exit code is non-zero (error)
          const exitCode = getExitCode();
          expect(exitCode).not.toBe(0);

          // consoleOutput may contain Clack decoration alongside JSON; extract the JSON block.
          const parsed = extractJson(consoleOutput) as Record<string, unknown>;
          expect(parsed).toMatchObject({
            code: 'CONTRACT.MARKER_MISSING',
            summary: expect.any(String),
            why: expect.any(String),
            fix: expect.any(String),
          });
          expect(parsed['summary']).toContain('Database not signed');
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'reports CONFIG.DRIVER_REQUIRED when driver is missing',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          // Set up test directory from fixtures with config that has db.connection but no driver
          const testSetup = setupTestDirectoryFromFixtures(
            createTempDir,
            fixtureSubdir,
            'prisma-next.config.no-driver.ts',
            { '{{DB_URL}}': connectionString },
          );
          const testDir = testSetup.testDir;
          const configPath = testSetup.configPath;

          // Emit contract first using the with-db config
          const emitTestSetup = setupTestDirectoryFromFixtures(
            createTempDir,
            fixtureSubdir,
            'prisma-next.config.with-db.ts',
            { '{{DB_URL}}': connectionString },
          );
          const emitConfigPath = emitTestSetup.configPath;

          const emitCommand = createContractEmitCommand();
          const originalCwd = process.cwd();
          try {
            process.chdir(emitTestSetup.testDir);
            await executeCommand(emitCommand, ['--config', emitConfigPath, '--no-color']);
          } finally {
            process.chdir(originalCwd);
          }

          const contractJsonPath = join(emitTestSetup.testDir, 'output', 'contract.json');
          const contract = loadContractFromDisk<Contract<SqlStorage>>(contractJsonPath);

          // Copy contract file to the test directory so the command can read it
          const testContractJsonPath = join(testDir, 'output', 'contract.json');
          const testContractDtsPath = join(testDir, 'output', 'contract.d.ts');
          mkdirSync(join(testDir, 'output'), { recursive: true });
          copyFileSync(contractJsonPath, testContractJsonPath);
          const emitContractDtsPath = join(emitTestSetup.testDir, 'output', 'contract.d.ts');
          try {
            await access(emitContractDtsPath);
            copyFileSync(emitContractDtsPath, testContractDtsPath);
          } catch {
            // contract.d.ts doesn't exist, skip copying
          }

          await withClient(connectionString, async (client) => {
            // Setup marker schema and table
            await bootstrapPostgresSignMarkerTables(client);

            // Write marker matching contract
            await seedTestMarker(client, {
              storageHash: contract.storage.storageHash,
              profileHash: contract.profileHash ?? contract.storage.storageHash,
              contractJson: contract,
              canonicalVersion: 1,
            });
            // withClient will close the client after this callback returns
          });

          const originalLoadConfig = await import('@internal/config-loader');
          vi.spyOn(originalLoadConfig, 'loadConfigForSections').mockResolvedValue(
            ok({
              family: {
                familyId: 'sql',
                create: vi.fn().mockReturnValue({
                  deserializeContract: (json: unknown) => json,
                }),
              },
              target: { id: 'postgres', familyId: 'sql', targetId: 'postgres', create: vi.fn() },
              adapter: { id: 'postgres', familyId: 'sql', targetId: 'postgres', create: vi.fn() },
              // driver is missing - this is what we're testing
              extensions: [],
              contract: typescriptContract(contract, 'output/contract.json'),
              db: {
                connection: connectionString,
              },
            } as unknown as import('@internal/config-loader').PrismaNextConfig),
          );

          const command = createDbVerifyCommand();
          const verifyCwd3 = process.cwd();
          try {
            process.chdir(testDir);
            await expect(
              executeCommand(command, ['--config', configPath, '--json']),
            ).rejects.toThrow('process.exit called');
          } finally {
            process.chdir(verifyCwd3);
          }

          // Check exit code is non-zero (error)
          const exitCode = getExitCode();
          expect(exitCode).not.toBe(0);

          // consoleOutput may contain Clack decoration alongside JSON; extract the JSON block.
          const parsed = extractJson(consoleOutput) as Record<string, unknown>;
          expect(parsed).toMatchObject({
            code: 'CONFIG.DRIVER_REQUIRED',
            summary: expect.any(String),
            why: expect.any(String),
            fix: expect.any(String),
          });
          expect(parsed['summary']).toContain('Driver is required');
        });
      },
      timeouts.spinUpPpgDev,
    );
  });
});
