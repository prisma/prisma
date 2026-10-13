import { relative } from 'pathe';

/**
 * Where the user ran the CLI from, the `--config` they gave it, as they typed it, and whether they
 * gave it `--db`.
 */
export interface CliInvocation {
  readonly cwd: string;
  readonly configPath: string | undefined;
  readonly dbGiven: boolean;
}

/** The invocation of a command run with `ctx`, given `--db` when `db` is defined. */
export function cliInvocation(
  ctx: { readonly cwd: string; readonly configPath: string | undefined },
  db: string | undefined,
): CliInvocation {
  return { cwd: ctx.cwd, configPath: ctx.configPath, dbGiven: db !== undefined };
}

/** The commands that connect to a database, and so take `--db`. */
const COMMANDS_TAKING_DB: ReadonlySet<string> = new Set([
  'contract infer',
  'db init',
  'db migrate',
  'db schema',
  'db sign',
  'db update',
  'db verify',
  'migration log',
  'migration status',
]);

function configWords(configPath: string | undefined): readonly string[] {
  return configPath === undefined ? [] : ['--config', `"${configPath}"`];
}

/**
 * A CLI command as advice prints it: `{bin}`, the command and its arguments, the `--config` the CLI
 * was given, and, for a command that connects to a database, `--db <url>` when the CLI was given
 * `--db`, so it runs as printed from the directory the CLI ran in, against the same database. The
 * URL stays a placeholder because it can hold credentials.
 */
export function cliCommand(
  invocation: CliInvocation | undefined,
  command: string,
  args: readonly string[] = [],
): string {
  return [
    '{bin}',
    command,
    ...args,
    ...configWords(invocation?.configPath),
    ...(invocation?.dbGiven === true && COMMANDS_TAKING_DB.has(command) ? ['--db', '<url>'] : []),
  ].join(' ');
}

/**
 * The command that runs a `migration.ts`, named relative to the directory the CLI ran in, with the
 * `--config` the CLI was given, so it loads the same config.
 */
export function selfEmitCommand(migrationTs: string, configPath: string | undefined): string {
  return [`node "${migrationTs}"`, ...configWords(configPath)].join(' ');
}

/** A path as advice prints it: relative to the directory the CLI ran in. */
export function printedPath(invocation: CliInvocation, path: string): string {
  return relative(invocation.cwd, path);
}
