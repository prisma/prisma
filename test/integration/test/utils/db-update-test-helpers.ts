import { loadOrmConfig, ormCommandFamily } from '@internal/cli';
import { ifDefined } from '@internal/utils/defined';
import type { StreamEvent } from '@prisma/cli-engine';
import { createTestCli } from '@prisma/cli-engine/testing';
import type { setupTestDirectoryFromFixtures } from './cli-test-helpers';
import { setupDbTestFixture } from './cli-test-helpers';

export type DbUpdateTestSetup = ReturnType<typeof setupTestDirectoryFromFixtures>;

export async function setupDbUpdateFixture(
  connectionString: string,
  createTempDir: () => string,
  fixtureSubdir: string,
  schemaSql?: string,
): Promise<{ testSetup: DbUpdateTestSetup; configPath: string }> {
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
    const arg = args[i] ?? '';
    if (arg === '--config') {
      configPath = args[i + 1];
      i += 1;
      continue;
    }
    if (arg.startsWith('--config=')) {
      configPath = arg.slice('--config='.length);
      continue;
    }
    rest.push(arg);
  }
  return { configPath, rest };
}

/** What one `db update` run reported. */
export interface DbUpdateRun {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  /** Parsed stream (events plus the terminal result) in json mode. */
  readonly json: readonly StreamEvent[];
  /**
   * The command's own document: the envelope's `result` when it completed and
   * its `error` when it did not. Undefined for a run that never settled a
   * command, and in human mode, where no frame is written.
   */
  readonly document: unknown;
}

function terminalDocument(json: readonly StreamEvent[]): unknown {
  const terminal = json.at(-1);
  if (terminal === undefined || terminal.kind !== 'result') {
    return undefined;
  }
  return terminal.envelope.ok ? terminal.envelope.result : terminal.envelope.error;
}

/**
 * Runs `db update` through the engine. The step's directory is passed as `cwd`
 * rather than chdir'ed into, so nothing about the run is process-global — which
 * also means its output is on the returned streams rather than in whatever the
 * caller has mocked the console with.
 */
export async function runDbUpdate(
  testSetup: DbUpdateTestSetup,
  args: readonly string[],
): Promise<DbUpdateRun> {
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
  // Format auto-selection is the engine's: json off a TTY. A step that asks for
  // human output has to say its streams are terminals, as the journey harness does.
  const run = await cli.run(['db', 'update', ...rest], {
    cwd: testSetup.testDir,
    isTty: { stdout: true, stderr: true },
  });
  return {
    exitCode: run.exitCode,
    stdout: run.stdout,
    stderr: run.stderr,
    json: run.json,
    document: terminalDocument(run.json),
  };
}

/**
 * The engine settles every failure into an exit code rather than throwing, so
 * this is the same call. It survives as its own name because the call sites say
 * which of the two they mean.
 */
export const runDbUpdateAllowFailure = runDbUpdate;

/**
 * What `db update` asks the user to type before it destroys anything: the
 * database named by the connection it resolved. A run that means to accept data
 * loss passes it as `--confirm`, because `--yes` cannot grant a consent.
 */
export function consentTokenFor(connectionString: string): string {
  const segments = new URL(connectionString).pathname
    .split('/')
    .filter((segment) => segment.length > 0);
  const database = segments.at(-1);
  if (database === undefined) {
    throw new Error(`consentTokenFor: ${connectionString} names no database`);
  }
  return database;
}
