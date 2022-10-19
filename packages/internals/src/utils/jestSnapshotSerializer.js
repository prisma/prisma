const path = require('path')
const replaceAll = require('replace-string') // sindre's replaceAll polyfill
const stripAnsi = require('strip-ansi')
const { platformRegex } = require('./platformRegex')

// Pipe utility
const pipe =
  (...fns) =>
  (x) =>
    fns.reduce((v, f) => f(v), x)

function normalizePrismaPaths(str) {
  return str
    .replace(/prisma\\([\w-]+)\.prisma/g, 'prisma/$1.prisma')
    .replace(/prisma\\seed\.ts/g, 'prisma/seed.ts')
    .replace(/custom-folder\\seed\.js/g, 'custom-folder/seed.js')
}

function normalizeLogs(str) {
  return str
    .replace(
      /Started query engine http server on http:\/\/127\.0\.0\.1:\d{1,5}/g,
      'Started query engine http server on http://127.0.0.1:00000',
    )
    .replace(/Starting a postgresql pool with \d+ connections./g, 'Starting a postgresql pool with XX connections.')
}

function normalizeTmpDir(str) {
  return str.replace(/\/tmp\/([a-z0-9]+)\//g, '/tmp/dir/')
}

function trimErrorPaths(str) {
  const parentDir = path.dirname(path.dirname(path.dirname(__dirname)))

  return replaceAll(str, parentDir, '')
}

function normalizeToUnixPaths(str) {
  // TODO: Windows: this breaks some tests by replacing backslashes outside of file names.
  return replaceAll(str, path.sep, '/')
}

function normalizeGitHubLinks(str) {
  return str.replace(/https:\/\/github.com\/prisma\/prisma(-client-js)?\/issues\/new\S+/, 'TEST_GITHUB_LINK')
}

function normalizeTsClientStackTrace(str) {
  return str
    .replace(/([/\\]client[/\\]src[/\\]__tests__[/\\].*test\.ts)(:\d*:\d*)/, '$1:0:0')
    .replace(/([/\\]client[/\\]tests[/\\]functional[/\\].*\.ts)(:\d*:\d*)/, '$1:0:0')
}

function removePlatforms(str) {
  return str.replace(platformRegex, 'TEST_PLATFORM')
}

// When updating snapshots this is sensitive to OS
// macOS will update extension to .dylib.node, but CI uses .so.node for example
// Note that on Windows the file name doesn't start with "lib".
function normalizeNodeApiLibFilePath(str) {
  return str.replace(
    /((lib)?query_engine-TEST_PLATFORM.)(.*)(.node)/,
    'libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node',
  )
}

function normalizeBinaryFilePath(str) {
  return str.replace(/query-engine-TEST_PLATFORM\.exe/, 'query-engine-TEST_PLATFORM')
}

function normalizeMigrateTimestamps(str) {
  return str.replace(/(?<!\d)\d{14}(?!\d)/g, '20201231000000')
  // return str.replace(/\d{14}/g, '20201231000000')
}

function normalizeDbUrl(str) {
  return str.replace(/(localhost|postgres|mysql|mssql|mongodb_migrate|cockroachdb):(\d+)/g, 'localhost:$2')
}

function normalizeRustError(str) {
  return str.replace(/\/rustc\/(.+)\//g, '/rustc/hash/').replace(/(\[.*)(:\d*:\d*)(\])/g, '[/some/rust/path:0:0$3')
}

function normalizeArtificialPanic(str) {
  return str.replace(/(Command failed with exit code 101:) (.+) /g, '$1 prisma-engines-path ')
}

function normalizeTime(str) {
  // sometimes something can take a few seconds when usually it's less than 1s or a few ms
  return str.replace(/ \d+ms/g, ' XXXms').replace(/ \d+(\.\d+)?s/g, ' XXXms')
}

/**
 * Replace dynamic variable bits of Prisma schema with static strings.
 * Only for integration-tests
 */
function prepareSchemaForSnapshot(str) {
  if (!str.includes('tmp/prisma-tests/integration-test')) return str

  const urlRegex = /url\s*=\s*.+/
  const outputRegex = /output\s*=\s*.+/
  return str
    .split('\n')
    .map((line) => {
      const urlMatch = urlRegex.exec(line)
      if (urlMatch) {
        return `${line.slice(0, urlMatch.index)}url = "***"`
      }
      const outputMatch = outputRegex.exec(line)
      if (outputMatch) {
        return `${line.slice(0, outputMatch.index)}output = "***"`
      }
      return line
    })
    .join('\n')
}

module.exports = {
  // Expected by Jest
  test(value) {
    return typeof value === 'string' || value instanceof Error
  },
  serialize(value) {
    const message = typeof value === 'string' ? value : value instanceof Error ? value.message : ''

    // order is important
    return pipe(
      stripAnsi,
      // integration-tests pkg
      prepareSchemaForSnapshot,
      // Generic
      normalizeTmpDir,
      normalizeTime,
      // From Client package
      normalizeGitHubLinks,
      removePlatforms,
      normalizeNodeApiLibFilePath,
      normalizeBinaryFilePath,
      normalizeTsClientStackTrace,
      trimErrorPaths,
      normalizePrismaPaths,
      normalizeLogs,
      // remove windows \\
      normalizeToUnixPaths,
      // From Migrate/CLI package
      normalizeDbUrl,
      normalizeRustError,
      normalizeMigrateTimestamps,
      // artificial panic
      normalizeArtificialPanic,
    )(message)
  },
}
