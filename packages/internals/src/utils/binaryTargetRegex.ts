import { binaryTargets } from '@prisma/get-platform'
import escapeString from 'escape-string-regexp'

/**
 * This regex matches all supported binary target names in a given string.
 *
 * Platform names are sorted by their lengths in descending order to ensure that
 * the longest substring is always matched (e.g., "darwin-arm64" is matched as a
 * whole instead of "darwin" and "arm" separately)
 */
export const binaryTargetRegex = new RegExp(
  `(${[...binaryTargets]
    .sort((a, b) => b.length - a.length)
    .map((p) => escapeString(p))
    .join('|')})`,
  'g',
)
