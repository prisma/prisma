import { ifDefined } from '@internal/utils/defined';
import type { Cli, HostProcess, MountedTree, Runtime } from '@prisma/cli-engine';
import { createCli } from '@prisma/cli-engine';
import { version as CLI_VERSION } from '../../package.json' with { type: 'json' };
import { dbSignCommand } from './db/sign';
import { dbVerifyCommand } from './db/verify';
import { ormCommandFamily } from './family';
import { loadOrmConfig } from './load-config';
import { migrationCheckCommand } from './migration/check';
import { migrationGraphCommand } from './migration/graph';
import { migrationListCommand } from './migration/list';
import { migrationLogCommand } from './migration/log';
import { migrationShowCommand } from './migration/show';
import { normalizeError } from './normalize-error';
import { resolveTelemetryHooks } from './telemetry/reporting';

export const BIN_NAME = 'prisma-next';

export const BIN_GROUPS = {
  db: {
    brief: 'Database lifecycle commands',
    description:
      'Inspect, verify and sign the live database against the emitted contract.\n' +
      'Every command in this group needs a database connection.',
  },
  migration: {
    brief: 'On-disk migration management commands',
    description:
      'Plan, apply, and scaffold on-disk migration packages. Migrations are\n' +
      'contract-to-contract edges stored as versioned directories under migrations/.',
  },
} as const;

export const BIN_COMMANDS: MountedTree = {
  'db sign': dbSignCommand,
  'db verify': dbVerifyCommand,
  'migration check': migrationCheckCommand,
  'migration graph': migrationGraphCommand,
  'migration list': migrationListCommand,
  'migration log': migrationLogCommand,
  'migration show': migrationShowCommand,
};

export function createOrmCli(): Cli {
  return createCli({
    name: BIN_NAME,
    version: CLI_VERSION,
    commandFamilies: [ormCommandFamily],
    groups: BIN_GROUPS,
    commands: BIN_COMMANDS,
  });
}

function packageManagerFrom(
  env: Readonly<Record<string, string | undefined>>,
): Runtime['packageManager'] {
  const userAgent = env['npm_config_user_agent'];
  const name = userAgent?.split('/')[0];
  return name === 'npm' || name === 'pnpm' || name === 'yarn' || name === 'bun' ? name : 'unknown';
}

/**
 * Everything environmental the engine is given, adapted from the host process
 * once. The engine owns signal policy; the bin is dumb wiring.
 */
export function runtimeFromProcess(proc: HostProcess): Runtime {
  return {
    stdout: { write: (text) => void proc.stdout.write(text) },
    // The terminal width the drawings get to use, read once with everything
    // else the runtime carries.
    stderr: {
      write: (text) => void proc.stderr.write(text),
      // biome-ignore lint/plugin/no-family-vocabulary: the terminal's width in characters, not storage
      ...ifDefined('columns', proc.stderr.columns),
    },
    stdin: proc.stdin,
    cwd: proc.cwd(),
    env: proc.env,
    isTty: {
      stdin: proc.stdin.isTTY === true,
      stdout: proc.stdout.isTTY === true,
      stderr: proc.stderr.isTTY === true,
    },
    exit: (code) => proc.exit(code),
    onSignal: (callback) => {
      const onInterrupt = () => callback('SIGINT');
      const onTerminate = () => callback('SIGTERM');
      proc.on('SIGINT', onInterrupt);
      proc.on('SIGTERM', onTerminate);
      return () => {
        proc.off('SIGINT', onInterrupt);
        proc.off('SIGTERM', onTerminate);
      };
    },
    loadConfig: (configPath) =>
      loadOrmConfig({ cwd: proc.cwd(), ...ifDefined('configPath', configPath) }),
    managementApi: { baseUrl: 'https://api.prisma.io' },
    packageManager: packageManagerFrom(proc.env),
  };
}

/** What the engine itself exits with for a failure it cannot attribute to a command. */
const STARTUP_FAILURE_EXIT_CODE = 1;

/**
 * The engine settles everything that happens inside a run. What happens before one exists —
 * reading the config, resolving telemetry, building the CLI — has no invocation to attach a
 * diagnostic to, so a throw there would reach the user as a raw stack trace. This writes the
 * same single line the engine writes in that position instead.
 */
function reportStartupFailure(proc: HostProcess, error: unknown): number {
  const normalized = normalizeError(error);
  proc.stderr.write(`✘ [${normalized.code}] ${normalized.message}\n`);
  return STARTUP_FAILURE_EXIT_CODE;
}

/** Parses, executes and settles one invocation; returns the exit code. */
export async function runOrmCli(proc: HostProcess): Promise<number> {
  try {
    const hooks = resolveTelemetryHooks(proc);
    return await createOrmCli().run(proc.argv.slice(2), runtimeFromProcess(proc), hooks);
  } catch (error) {
    return reportStartupFailure(proc, error);
  }
}
