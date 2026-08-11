import { loadOrmConfig, ormCommandFamily } from '@internal/cli';
import { ifDefined } from '@internal/utils/defined';
import { createTestCli } from '@prisma/cli-engine/testing';
import type { setupTestDirectoryFromFixtures } from './cli-test-helpers';
import { setupDbTestFixture } from './cli-test-helpers';

export type DbInitTestSetup = ReturnType<typeof setupTestDirectoryFromFixtures>;

export async function setupDbInitFixture(
  connectionString: string,
  createTempDir: () => string,
  fixtureSubdir: string,
  schemaSql?: string,
): Promise<{ testSetup: DbInitTestSetup; configPath: string }> {
  return setupDbTestFixture({
    connectionString,
    createTempDir,
    fixtureSubdir,
    ...ifDefined('schemaSql', schemaSql),
  });
}

/**
 * `--config <path>` as the engine harness needs it: the harness seeds the
 * sections directly rather than loading a file, so the path is consumed here
 * and the flag is dropped from the argv it never has to parse.
 */
function splitConfigPath(args: readonly string[]): {
  readonly configPath: string | undefined;
  readonly rest: readonly string[];
} {
  const rest: string[] = [];
  let configPath: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--config') {
      configPath = args[i + 1];
      i += 1;
      continue;
    }
    if (arg !== undefined && arg.startsWith('--config=')) {
      configPath = arg.slice('--config='.length);
      continue;
    }
    if (arg !== undefined) {
      rest.push(arg);
    }
  }
  return { configPath, rest };
}

/**
 * Runs `db init` through the engine and returns its exit code. The step's
 * directory is passed as `cwd` rather than chdir'ed into, so nothing about the
 * run is process-global.
 */
export async function runDbInit(
  testSetup: DbInitTestSetup,
  args: readonly string[],
): Promise<number> {
  const { configPath, rest } = splitConfigPath(args);
  const loaded = await loadOrmConfig({
    cwd: testSetup.testDir,
    ...ifDefined('configPath', configPath),
  });
  const cli = createTestCli({
    commandFamilies: [ormCommandFamily],
    commands: ormCommandFamily.commands,
    groups: {
      db: { brief: 'Live database commands' },
      migration: { brief: 'On-disk migration management commands' },
    },
    config: loaded.sections,
  });
  const run = await cli.run(['db', 'init', ...rest], { cwd: testSetup.testDir });
  return run.exitCode;
}

/**
 * The engine settles every failure into an exit code rather than throwing, so
 * this is the same call. It survives as its own name because the call sites say
 * which of the two they mean.
 */
export const runDbInitAllowFailure = runDbInit;
