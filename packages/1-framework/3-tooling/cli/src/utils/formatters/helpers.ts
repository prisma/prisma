import { dim } from 'colorette';

import type { GlobalFlags } from '../global-flags';

/**
 * Checks if verbose output is enabled at the specified level.
 */
export function isVerbose(flags: GlobalFlags, level: 1 | 2): boolean {
  return (flags.verbose ?? 0) >= level;
}

/**
 * Creates a color-aware formatter function.
 * Returns a function that applies the color only if colors are enabled.
 */
export function createColorFormatter<T extends (text: string) => string>(
  useColor: boolean,
  colorFn: T,
): (text: string) => string {
  return useColor ? colorFn : (text: string) => text;
}

/**
 * Formats text with dim styling if colors are enabled.
 */
export function formatDim(useColor: boolean, text: string): string {
  return useColor ? dim(text) : text;
}
