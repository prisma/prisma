import type { Cli, HostProcess, LoadedConfig, MountedTree, Runtime } from '@prisma/cli-engine';
import { createCli } from '@prisma/cli-engine';
import { version as CLI_VERSION } from '../../package.json' with { type: 'json' };
import { ormCommandFamily } from './family';
import { loadOrmConfig } from './load-config';
import { migrationListCommand } from './migration/list';
import { resolveTelemetryHooks } from './telemetry/reporting';

export const BIN_NAME = 'prisma-next';

const CONFIG_FLAG = '--config';

export interface StrippedConfigFlag {
  readonly argv: readonly string[];
  readonly configPath: string | undefined;
}

/**
 * Interim, pending the engine's own shell-level `--config`: the pinned engine
 * reserves no such flag and would reject it, so the bin reads it off argv and
 * removes it before the engine parses. A trailing `--config` with no value is
 * left in place so the engine reports it as an argument error. Arguments after
 * a bare `--` are positionals, never flags.
 */
export function stripConfigFlag(argv: readonly string[]): StrippedConfigFlag {
  const kept: string[] = [];
  let configPath: string | undefined;

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === undefined) {
      continue;
    }
    if (argument === '--') {
      kept.push(...argv.slice(index));
      break;
    }
    if (argument.startsWith(`${CONFIG_FLAG}=`)) {
      configPath = argument.slice(CONFIG_FLAG.length + 1);
      continue;
    }
    if (argument === CONFIG_FLAG) {
      const value = argv[index + 1];
      if (value === undefined) {
        kept.push(argument);
        continue;
      }
      configPath = value;
      index += 1;
      continue;
    }
    kept.push(argument);
  }

  return { argv: kept, configPath };
}

export const BIN_GROUPS = {
  migration: {
    brief: 'On-disk migration management commands',
    description:
      'Plan, apply, and scaffold on-disk migration packages. Migrations are\n' +
      'contract-to-contract edges stored as versioned directories under migrations/.',
  },
} as const;

export const BIN_COMMANDS: MountedTree = {
  'migration list': migrationListCommand,
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
export function runtimeFromProcess(proc: HostProcess, config: LoadedConfig): Runtime {
  return {
    stdout: { write: (text) => void proc.stdout.write(text) },
    stderr: { write: (text) => void proc.stderr.write(text) },
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
    config,
    managementApi: { baseUrl: 'https://api.prisma.io' },
    packageManager: packageManagerFrom(proc.env),
  };
}

/** Parses, executes and settles one invocation; returns the exit code. */
export async function runOrmCli(proc: HostProcess): Promise<number> {
  const { argv, configPath } = stripConfigFlag(proc.argv.slice(2));
  const config = await loadOrmConfig({
    cwd: proc.cwd(),
    ...(configPath === undefined ? {} : { configPath }),
  });
  const hooks = resolveTelemetryHooks(proc);
  return createOrmCli().run(argv, runtimeFromProcess(proc, config), hooks);
}
