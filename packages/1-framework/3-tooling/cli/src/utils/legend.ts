import { notOk, ok, type Result } from '@internal/utils/result';
import { type CliStructuredError, errorLegendHumanOnly } from './cli-errors';
import type { GlobalFlags } from './global-flags';

export interface LegendCliOptions {
  readonly legend?: boolean;
  readonly dot?: boolean;
}

/**
 * The legend is decoration printed alongside the command header on stderr, so
 * it is suppressed for the machine-readable / silent paths (`--json`, `--dot`,
 * `--quiet`) exactly as the header is.
 */
export function shouldShowLegend(options: LegendCliOptions, flags: GlobalFlags): boolean {
  return (
    options.legend === true && options.dot !== true && flags.json !== true && flags.quiet !== true
  );
}

export function validateLegendOptions(
  options: LegendCliOptions,
  flags: GlobalFlags,
): Result<void, CliStructuredError> {
  if (options.legend !== true) {
    return ok(undefined);
  }
  if (flags.json === true) {
    return notOk(errorLegendHumanOnly('--json'));
  }
  if (flags.quiet === true) {
    return notOk(errorLegendHumanOnly('--quiet'));
  }
  if (options.dot === true) {
    return notOk(errorLegendHumanOnly('--dot'));
  }
  return ok(undefined);
}
