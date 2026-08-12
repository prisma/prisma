import type { Result } from '@internal/utils/result';
import type { CliStructuredError } from './cli-errors';
import { formatErrorJson, formatErrorOutput } from './formatters/errors';
import type { GlobalFlags } from './global-flags';
import type { TerminalUI } from './terminal-ui';

/**
 * Processes a CLI command result, handling both success and error cases.
 * Formats output appropriately and returns the exit code.
 * Never throws - returns exit code for commands to use with process.exit().
 *
 * Error output:
 * - JSON mode: JSON error to stdout (piped) via ui.output(), human sees nothing on stderr.
 * - Interactive: human-readable error to stderr.
 */
export function handleResult<T>(
  result: Result<T, CliStructuredError>,
  flags: GlobalFlags,
  ui: TerminalUI,
  onSuccess?: (value: T) => void,
): number {
  if (result.ok) {
    if (onSuccess) {
      onSuccess(result.value);
    }
    return 0;
  }

  // Convert to CLI envelope
  const envelope = result.failure.toEnvelope();

  if (flags.json) {
    // JSON error → stdout only
    ui.output(formatErrorJson(envelope));
  } else {
    // Human-readable error → stderr
    ui.error(formatErrorOutput(envelope, flags));
  }

  // Every structured failure reaching this point is an expected failure and
  // exits 2 (PRECONDITION), except a user-declined prompt, which exits 3
  // (USER_ABORTED). See CLI Style Guide § Exit Codes / ADR 239 § Exit codes.
  const exitCode = result.failure.code === 'CLI.INIT_USER_ABORTED' ? 3 : 2;
  return exitCode;
}
