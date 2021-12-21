import stripAnsi from 'strip-ansi'

function normalizeMigrateTimestamps(str) {
  return str.replace(/\d{14}/g, '20201231000000')
}

function normalizeDbUrl(str) {
  return str.replace(/(localhost|postgres|mysql|mssql):\d+/g, 'localhost:5432')
}

function normalizeRustError(str) {
  return str.replace(/\/rustc\/(.+)\//g, '/rustc/hash/').replace(/(\[.*)(:\d*:\d*)(\])/g, '[/some/rust/path:0:0$3')
}

function normalizeTime(str: string): string {
  // sometimes soneting can take a few seconds when usually it's less than 1s
  return str.replace(/ \d+ms/g, ' XXXms').replace(/ \d+(.\d+)?s/g, ' XXXms')
}

function normalizePaths(str: string): string {
  return str
    .replace(/prisma\\([\w-]+)\.prisma/g, 'prisma/$1.prisma')
    .replace(/prisma\\seed\.ts/g, 'prisma/seed.ts')
    .replace(/custom-folder\\seed\.js/g, 'custom-folder/seed.js')
}

export function test(value) {
  return typeof value === 'string' || value instanceof Error
}

export function serialize(value) {
  const message = typeof value === 'string' ? value : value instanceof Error ? value.message : ''
  return normalizePaths(
    normalizeDbUrl(normalizeTime(normalizeRustError(normalizeMigrateTimestamps(stripAnsi(message))))),
  )
}
