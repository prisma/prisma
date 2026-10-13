import { relative } from 'pathe';

/** Where the user ran the CLI from, and the `--config` they gave it, as they typed it. */
export interface CliInvocation {
  readonly cwd: string;
  readonly configPath: string | undefined;
}

function configWords(configPath: string | undefined): readonly string[] {
  return configPath === undefined ? [] : ['--config', `"${configPath}"`];
}

/**
 * A CLI command as advice prints it: `{bin}`, the command and its arguments, and the `--config` the
 * CLI was given, so it runs as printed from the directory the CLI ran in.
 */
export function cliCommand(invocation: CliInvocation | undefined, args: readonly string[]): string {
  return ['{bin}', ...args, ...configWords(invocation?.configPath)].join(' ');
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
