import stripAnsi from 'strip-ansi'

export function removeISODate(str: string): string {
  return str.replace(/\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/gim, '')
}

export function sanitizeTestLogs(str: string): string {
  return stripAnsi(str)
    .split('\n')
    .map((l) => removeISODate(l.replace(/\+\d+ms$/, '')).trim())
    .join('\n')
}
