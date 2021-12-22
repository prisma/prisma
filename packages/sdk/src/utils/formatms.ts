/**
 * Formats a time interval in milliseconds, converting it to seconds if `ms` >= 1000.
 * Returns a string like "3ms" or "3.10s".
 */
export function formatms(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }

  return (ms / 1000).toFixed(2) + 's'
}
