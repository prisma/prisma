import { notOk } from '@internal/utils/result';
import { CliStructuredError, errorInvalidOutputFormat, errorOutputFormatMutex } from './cli-errors';
import { isCI } from './is-ci';
import { handleResult } from './result-handler';
import { createTerminalUI } from './terminal-ui';

export type OutputFormat = 'pretty' | 'json';

export interface GlobalFlags {
  readonly format: OutputFormat;
  readonly explicitFormat: boolean;
  readonly json?: boolean;
  readonly quiet?: boolean;
  readonly verbose?: number;
  readonly color?: boolean;
  readonly interactive?: boolean;
  readonly yes?: boolean;
}

/**
 * Common options parsed by Commander.js for every command.
 * Extend this for command-specific options instead of duplicating these fields.
 */
export interface CommonCommandOptions {
  readonly format?: string;
  readonly json?: string | boolean;
  readonly quiet?: boolean;
  readonly q?: boolean;
  readonly verbose?: boolean;
  readonly v?: boolean;
  readonly trace?: boolean;
  readonly color?: boolean;
  readonly 'no-color'?: boolean;
  readonly interactive?: boolean;
  readonly 'no-interactive'?: boolean;
  readonly yes?: boolean;
  readonly y?: boolean;
}

function isJsonFlagSet(json: string | boolean | undefined): boolean {
  return json === true;
}

interface ResolvedOutputFormat {
  readonly format: OutputFormat;
  readonly explicitFormat: boolean;
}

function resolveOutputFormat(options: CommonCommandOptions): ResolvedOutputFormat {
  const formatOption = options.format;
  const jsonFlag = isJsonFlagSet(options.json);

  if (formatOption !== undefined) {
    if (formatOption !== 'pretty' && formatOption !== 'json') {
      throw errorInvalidOutputFormat(formatOption);
    }
    if (jsonFlag && formatOption === 'pretty') {
      throw errorOutputFormatMutex();
    }
    return { format: formatOption, explicitFormat: true };
  }

  if (jsonFlag) {
    return { format: 'json', explicitFormat: false };
  }

  if (!process.stdout.isTTY) {
    return { format: 'json', explicitFormat: false };
  }

  return { format: 'pretty', explicitFormat: false };
}

function inferJsonModeForParseError(options: CommonCommandOptions): boolean {
  if (options.format === 'json') {
    return true;
  }
  if (isJsonFlagSet(options.json) && options.format !== 'pretty') {
    return true;
  }
  if (options.format !== undefined) {
    return false;
  }
  return !process.stdout.isTTY;
}

function emitGlobalFlagParseError(error: CliStructuredError, options: CommonCommandOptions): never {
  const jsonMode = inferJsonModeForParseError(options);
  const flags: GlobalFlags = {
    format: jsonMode ? 'json' : 'pretty',
    explicitFormat: false,
    ...(jsonMode ? { json: true } : {}),
    color: false,
    verbose: 0,
    interactive: false,
  };
  const ui = createTerminalUI(flags);
  const exitCode = handleResult(notOk(error), flags, ui);
  process.exit(exitCode);
}

/**
 * Parses global flags from CLI options.
 * Handles verbosity flags (-v, --trace), output format (--format, --json),
 * quiet mode, color, interactivity (--interactive/--no-interactive), and
 * auto-accept (-y/--yes).
 *
 * On invalid or conflicting format flags, prints a structured CLI error
 * envelope and exits with code 2.
 */
export function parseGlobalFlagsOrExit(options: CommonCommandOptions): GlobalFlags {
  try {
    return parseGlobalFlags(options);
  } catch (error) {
    if (CliStructuredError.is(error)) {
      emitGlobalFlagParseError(error, options);
    }
    throw error;
  }
}

/**
 * Parses global flags from CLI options.
 * Handles verbosity flags (-v, --trace), output format (--format, --json),
 * quiet mode, color, interactivity (--interactive/--no-interactive), and
 * auto-accept (-y/--yes).
 *
 * Throws {@link CliStructuredError} for invalid or conflicting format flags.
 */
export function parseGlobalFlags(options: CommonCommandOptions): GlobalFlags {
  const { format, explicitFormat } = resolveOutputFormat(options);
  const flags: {
    format: OutputFormat;
    explicitFormat: boolean;
    json?: boolean;
    quiet?: boolean;
    verbose?: number;
    color?: boolean;
    interactive?: boolean;
    yes?: boolean;
  } = { format, explicitFormat };

  if (format === 'json') {
    flags.json = true;
  }

  if (options.quiet || options.q) {
    flags.quiet = true;
  }

  if (options.trace || process.env['PRISMA_NEXT_TRACE'] === '1') {
    flags.verbose = 2;
  } else if (options.verbose || options.v || process.env['PRISMA_NEXT_DEBUG'] === '1') {
    flags.verbose = 1;
  } else {
    flags.verbose = 0;
  }

  if (process.env['NO_COLOR'] || flags.json) {
    flags.color = false;
  } else if (options['no-color']) {
    flags.color = false;
  } else if (options.color !== undefined) {
    flags.color = options.color;
  } else {
    flags.color = process.stdout.isTTY && !isCI();
  }

  if (options['no-interactive']) {
    flags.interactive = false;
  } else if (options.interactive !== undefined) {
    flags.interactive = options.interactive;
  } else {
    flags.interactive = !!process.stdout.isTTY;
  }

  if (options.yes || options.y) {
    flags.yes = true;
  }

  return flags as GlobalFlags;
}

/**
 * Bridges the two TTY checks (stdout via `flags`, stdin via
 * `process.stdin.isTTY`) into the `canPrompt` boolean the interactive
 * `init` flow consumes.
 *
 * Per the [Style Guide § Interactivity](../../../../../../../docs/CLI%20Style%20Guide.md#interactivity):
 *
 * - `flags.interactive` governs *decoration* (TerminalUI, intro/outro,
 *   spinners) and is derived from stdout-TTY by `parseGlobalFlags`,
 *   honouring `--interactive` / `--no-interactive`.
 * - Prompting additionally requires a stdin TTY — closing stdin is a
 *   common signal in CI / agent environments even when stdout stays
 *   attached.
 * - `--interactive` is the explicit override: when the user passes it,
 *   we honour it (e.g. testing flows where stdin is stubbed).
 *
 * Single source of truth for the interactive-prompt decision: both the
 * `init` action handler and the preAction telemetry bridge derive
 * prompt-eligibility from this helper so they cannot drift. Lives in
 * `global-flags` (alongside `parseGlobalFlags`) to keep
 * `utils/telemetry` and `commands/init/index` free of an import cycle.
 *
 * Exported so callers and tests can derive the same value without
 * touching `process` globals.
 */
export function deriveCanPrompt(opts: {
  readonly flagsInteractive: boolean | undefined;
  readonly optionInteractive: boolean | undefined;
  readonly stdinIsTTY: boolean;
}): boolean {
  if (opts.optionInteractive === true) return true;
  if (opts.flagsInteractive === false) return false;
  return opts.stdinIsTTY;
}
