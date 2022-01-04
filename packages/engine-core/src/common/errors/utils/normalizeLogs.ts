/**
 * Removes the leading timestamps (from docker) and trailing ms (from debug)
 * @param logs logs to normalize
 */
export function normalizeLogs(logs: string): string {
  return logs
    .split('\n')
    .map((l) => {
      return l
        .replace(/^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)\s*/, '')
        .replace(/\+\d+\s*ms$/, '')
    })
    .join('\n')
}
