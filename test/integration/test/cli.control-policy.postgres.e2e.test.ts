import { readFileSync } from 'node:fs';
import { createDbVerifyCommand } from '@internal/cli/commands/db-verify';
import { timeouts, withClient, withDevDatabase } from '@repo/test-utils';
import { join } from 'pathe';
import stripAnsi from 'strip-ansi';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  executeCommand,
  getExitCode,
  setupCommandMocks,
  setupDbTestFixture,
  withTempDir,
} from './utils/cli-test-helpers';
import { runDbInit } from './utils/db-init-test-helpers';
import {
  type DbUpdateTestSetup,
  runDbUpdate,
  runDbUpdateAllowFailure,
} from './utils/db-update-test-helpers';

const fixtureSubdir = 'control-policy/postgres';
const externalFloorFixtureSubdir = 'control-policy/postgres-external-floor';

const AUTH_USERS_SEED_SQL = `
  CREATE TABLE IF NOT EXISTS public.auth_users (
    id integer NOT NULL,
    email text NOT NULL,
    PRIMARY KEY (id)
  );
`;

const LEGACY_JOBS_SEED_SQL = `
  CREATE TABLE IF NOT EXISTS public.legacy_jobs (
    id integer NOT NULL,
    status text NOT NULL,
    PRIMARY KEY (id)
  );
`;

const CONTROL_POLICY_BASE_SEED_SQL = `${AUTH_USERS_SEED_SQL}\n${LEGACY_JOBS_SEED_SQL}`;

async function setupControlPolicyPostgresFixture(
  connectionString: string,
  createTempDir: () => string,
): Promise<{ testSetup: DbUpdateTestSetup; configPath: string }> {
  return setupDbTestFixture({
    connectionString,
    createTempDir,
    fixtureSubdir,
    schemaSql: CONTROL_POLICY_BASE_SEED_SQL,
  });
}

async function setupExternalFloorFixture(
  connectionString: string,
  createTempDir: () => string,
): Promise<{ testSetup: DbUpdateTestSetup; configPath: string }> {
  return setupDbTestFixture({
    connectionString,
    createTempDir,
    fixtureSubdir: externalFloorFixtureSubdir,
  });
}

async function tableExists(
  connectionString: string,
  schema: string,
  table: string,
): Promise<boolean> {
  return withClient(connectionString, async (client) => {
    const result = await client.query(
      `
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = $2
      `,
      [schema, table],
    );
    return result.rows.length > 0;
  });
}

async function columnExists(
  connectionString: string,
  schema: string,
  table: string,
  column: string,
): Promise<boolean> {
  return withClient(connectionString, async (client) => {
    const result = await client.query(
      `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
      `,
      [schema, table, column],
    );
    return result.rows.length > 0;
  });
}

function extractJson(lines: string[]): Record<string, unknown> {
  const joined = lines.join('\n');
  const start = joined.indexOf('{');
  const end = joined.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`No JSON object found in output:\n${joined}`);
  }
  return JSON.parse(joined.slice(start, end + 1)) as Record<string, unknown>;
}

interface EmittedTable {
  readonly control?: string;
}

interface EmittedNamespace {
  readonly entries?: { readonly table?: Record<string, EmittedTable> };
}

interface EmittedContract {
  readonly defaultControlPolicy?: string;
  readonly storage: { readonly namespaces: Record<string, EmittedNamespace> };
}

function readEmittedContract(testSetup: DbUpdateTestSetup): EmittedContract {
  const path = join(testSetup.testDir, 'src/prisma/contract.json');
  return JSON.parse(readFileSync(path, 'utf-8')) as EmittedContract;
}

async function runDbVerifyJson(
  testSetup: DbUpdateTestSetup,
  configPath: string,
  consoleOutput: string[],
  outputStartIndex: number,
): Promise<{ exitCode: number; parsed: Record<string, unknown> }> {
  const command = createDbVerifyCommand();
  const verifyCwd = process.cwd();
  try {
    process.chdir(testSetup.testDir);
    try {
      await executeCommand(command, ['--config', configPath, '--json', '--no-color']);
    } catch {
      // db verify exits via process.exit on failure
    }
  } finally {
    process.chdir(verifyCwd);
  }
  const exitCode = getExitCode() ?? 0;
  const parsed = extractJson(consoleOutput.slice(outputStartIndex));
  return { exitCode, parsed };
}

withTempDir(({ createTempDir }) => {
  describe('control policy postgres CLI (e2e)', () => {
    let consoleOutput: string[] = [];
    let cleanupMocks: () => void;

    beforeEach(() => {
      const mocks = setupCommandMocks();
      consoleOutput = mocks.consoleOutput;
      cleanupMocks = mocks.cleanup;
    });

    afterEach(() => {
      cleanupMocks();
    });

    // Pins `prisma-next contract emit` end-to-end for every ControlPolicy value:
    // per-table `control` survives canonicalisation, and missing-control on the
    // table left at the contract default is omitted (default-omission). The
    // contract-level `defaultControlPolicy` round-trip is pinned by the
    // external-namespace-floor test below, which would not exhibit its
    // suppression warning unless contract.json carried the field.
    it(
      'contract.json carries every ControlPolicy value emitted by the real CLI pipeline',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testSetup } = await setupControlPolicyPostgresFixture(
            connectionString,
            createTempDir,
          );
          const contract = readEmittedContract(testSetup);
          const tables = contract.storage.namespaces['public']?.entries?.table ?? {};
          expect(tables['app_users']?.control).toBeUndefined();
          expect(tables['audit_log']?.control).toBe('tolerated');
          expect(tables['legacy_jobs']?.control).toBe('observed');
          expect(tables['auth_users']?.control).toBe('external');
          expect(contract.defaultControlPolicy).toBeUndefined();
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'contract.json carries top-level defaultControlPolicy from the external-namespace-floor fixture',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testSetup } = await setupExternalFloorFixture(connectionString, createTempDir);
          const contract = readEmittedContract(testSetup);
          expect(contract.defaultControlPolicy).toBe('external');
          const sessions = contract.storage.namespaces['auth']?.entries?.table?.['sessions'];
          expect(sessions?.control).toBe('managed');
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'managed: creates table on init and verifier fails after out-of-band drop',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testSetup, configPath } = await setupControlPolicyPostgresFixture(
            connectionString,
            createTempDir,
          );

          await runDbInit(testSetup, ['--config', configPath, '--no-color']);

          expect(await tableExists(connectionString, 'public', 'app_users')).toBe(true);

          await withClient(connectionString, async (client) => {
            await client.query('DROP TABLE public.app_users');
          });

          const outputStartIndex = consoleOutput.length;
          const { exitCode, parsed } = await runDbVerifyJson(
            testSetup,
            configPath,
            consoleOutput,
            outputStartIndex,
          );
          expect(exitCode).toBe(1);
          expect(parsed['ok']).toBe(false);
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'tolerated: preserves extra columns across update and verifier distinguishes extras from missing declared',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testSetup, configPath } = await setupControlPolicyPostgresFixture(
            connectionString,
            createTempDir,
          );

          await runDbInit(testSetup, ['--config', configPath, '--no-color']);

          await withClient(connectionString, async (client) => {
            await client.query('ALTER TABLE public.audit_log ADD COLUMN note text');
          });

          consoleOutput.length = 0;
          await runDbUpdate(testSetup, ['--config', configPath, '--no-color']);
          expect(await columnExists(connectionString, 'public', 'audit_log', 'note')).toBe(true);

          let outputStartIndex = consoleOutput.length;
          let verify = await runDbVerifyJson(
            testSetup,
            configPath,
            consoleOutput,
            outputStartIndex,
          );
          expect(verify.exitCode).toBe(0);
          expect(verify.parsed['ok']).toBe(true);

          await withClient(connectionString, async (client) => {
            await client.query('ALTER TABLE public.audit_log DROP COLUMN ts');
          });

          outputStartIndex = consoleOutput.length;
          verify = await runDbVerifyJson(testSetup, configPath, consoleOutput, outputStartIndex);
          expect(verify.exitCode).toBe(1);
          expect(verify.parsed['ok']).toBe(false);
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'external: zero DDL into namespace; verifier passes on extras and fails on declared drift',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testSetup, configPath } = await setupControlPolicyPostgresFixture(
            connectionString,
            createTempDir,
          );

          await runDbInit(testSetup, ['--config', configPath, '--no-color']);

          expect(await tableExists(connectionString, 'public', 'auth_users')).toBe(true);
          expect(await tableExists(connectionString, 'public', 'sessions')).toBe(false);

          let outputStartIndex = consoleOutput.length;
          let verify = await runDbVerifyJson(
            testSetup,
            configPath,
            consoleOutput,
            outputStartIndex,
          );
          expect(verify.exitCode).toBe(0);
          expect(verify.parsed['ok']).toBe(true);

          await withClient(connectionString, async (client) => {
            await client.query('ALTER TABLE public.auth_users ADD COLUMN extra_note text');
          });

          outputStartIndex = consoleOutput.length;
          verify = await runDbVerifyJson(testSetup, configPath, consoleOutput, outputStartIndex);
          expect(verify.exitCode).toBe(0);
          expect(verify.parsed['ok']).toBe(true);

          await withClient(connectionString, async (client) => {
            await client.query(
              'ALTER TABLE public.auth_users ALTER COLUMN email TYPE integer USING 0',
            );
          });

          outputStartIndex = consoleOutput.length;
          verify = await runDbVerifyJson(testSetup, configPath, consoleOutput, outputStartIndex);
          expect(verify.exitCode).toBe(1);
          expect(verify.parsed['ok']).toBe(false);
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'observed: zero DDL; verifier passes despite declared drift',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testSetup, configPath } = await setupControlPolicyPostgresFixture(
            connectionString,
            createTempDir,
          );

          await runDbInit(testSetup, ['--config', configPath, '--no-color']);

          expect(await tableExists(connectionString, 'public', 'legacy_jobs')).toBe(true);

          await withClient(connectionString, async (client) => {
            await client.query('DROP TABLE public.legacy_jobs');
          });

          const outputStartIndex = consoleOutput.length;
          const { exitCode, parsed } = await runDbVerifyJson(
            testSetup,
            configPath,
            consoleOutput,
            outputStartIndex,
          );
          expect(exitCode).toBe(0);
          expect(parsed['ok']).toBe(true);
          // Under the `observed` control policy the dropped table warns but does
          // not fail: the verify passes AND the warning is surfaced in the
          // output (watch-without-failing, not silent suppression).
          const schema = parsed['schema'] as { summary: string; warnings: readonly string[] };
          expect(schema.summary).toBe('Database schema satisfies contract');
          expect(schema.warnings.some((w) => w.includes('legacy_jobs'))).toBe(true);
        });
      },
      timeouts.spinUpPpgDev,
    );

    it(
      'external namespace floor: zero DDL and db update surfaces suppressed-call warnings',
      async () => {
        await withDevDatabase(async ({ connectionString }) => {
          const { testSetup, configPath } = await setupExternalFloorFixture(
            connectionString,
            createTempDir,
          );

          consoleOutput.length = 0;
          await runDbUpdate(testSetup, ['--config', configPath, '--dry-run', '--no-color']);
          const dryRunOutput = stripAnsi(consoleOutput.join('\n'));
          expect(dryRunOutput).toContain('Warnings:');
          expect(dryRunOutput).toContain('control policy suppressed: table "auth.sessions"');

          consoleOutput.length = 0;
          const applyStartIndex = consoleOutput.length;
          const applyExitCode = await runDbUpdateAllowFailure(testSetup, [
            '--config',
            configPath,
            '--no-color',
          ]);
          const applyOutput = stripAnsi(consoleOutput.slice(applyStartIndex).join('\n'));
          expect(applyOutput).toContain('Warnings:');
          expect(applyOutput).toContain('control policy suppressed: table "auth.sessions"');
          expect(applyExitCode).not.toBe(0);
          expect(await tableExists(connectionString, 'auth', 'sessions')).toBe(false);
        });
      },
      timeouts.spinUpPpgDev,
    );
  });
});
