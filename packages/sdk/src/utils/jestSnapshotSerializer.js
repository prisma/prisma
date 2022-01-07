const os = require('os')
const path = require('path')
const replaceAll = require('replace-string') // sindre's replaceAll polyfill
const stripAnsi = require('strip-ansi')
const { platformRegex } = require('./platformRegex')

// Pipe utility
const pipe =
  (...fns) =>
  (x) =>
    fns.reduce((v, f) => f(v), x)

// getRealPath & normalizePaths from
// https://github.com/tribou/jest-serializer-path/blob/master/lib/index.js
//
function getRealPath(pathname) {
  try {
    const realPath = fs.realpathSync(pathname)

    return realPath
  } catch (error) {
    return pathname
  }
}
/**
 * Normalize paths across platforms.
 * Filters must be ran on all platforms to guard against false positives
 */
function normalizePaths(value) {
  if (typeof value !== 'string') {
    return value
  }

  const cwd = process.cwd()
  const cwdReal = getRealPath(cwd)
  const tempDir = os.tmpdir()
  const tempDirReal = getRealPath(tempDir)
  const homeDir = os.homedir()
  const homeDirReal = getRealPath(homeDir)

  const homeRelativeToTemp = path.relative(tempDir, homeDir)
  const homeRelativeToTempReal = path.relative(tempDirReal, homeDir)
  const homeRealRelativeToTempReal = path.relative(tempDirReal, homeDirReal)
  const homeRealRelativeToTemp = path.relative(tempDir, homeDirReal)

  const runner = [
    // Replace process.cwd with <PROJECT_ROOT>
    (val) => val.split(cwdReal).join('<PROJECT_ROOT>'),
    (val) => val.split(cwd).join('<PROJECT_ROOT>'),

    // Replace home directory with <TEMP_DIR>
    (val) => val.split(tempDirReal).join('<TEMP_DIR>'),
    (val) => val.split(tempDir).join('<TEMP_DIR>'),

    // Replace home directory with <HOME_DIR>
    (val) => val.split(homeDirReal).join('<HOME_DIR>'),
    (val) => val.split(homeDir).join('<HOME_DIR>'),

    // handle HOME_DIR nested inside TEMP_DIR
    (val) => val.split(`<TEMP_DIR>${path.sep + homeRelativeToTemp}`).join('<HOME_DIR>'),
    (val) => val.split(`<TEMP_DIR>${path.sep + homeRelativeToTempReal}`).join('<HOME_DIR>'), // untested
    (val) => val.split(`<TEMP_DIR>${path.sep + homeRealRelativeToTempReal}`).join('<HOME_DIR>'),
    (val) => val.split(`<TEMP_DIR>${path.sep + homeRealRelativeToTemp}`).join('<HOME_DIR>'), // untested

    // Remove win32 drive letters, C:\ -> \
    (val) => val.replace(/[a-zA-Z]:\\/g, '\\'),

    // Convert win32 backslash's to forward slashes, \ -> /
    // (val) => slash(val),
  ]

  let result = value
  runner.forEach((current) => {
    result = current(result)
  })

  return result
}

function normalizePrismaPaths(str) {
  return str
    .replace(/prisma\\([\w-]+)\.prisma/g, 'prisma/$1.prisma')
    .replace(/prisma\\seed\.ts/g, 'prisma/seed.ts')
    .replace(/custom-folder\\seed\.js/g, 'custom-folder/seed.js')
}

// function normalizeTmpDir(str) {
//   return str.replace(/\/tmp\/([a-z0-9]+)\//g, '/tmp/dir/')
// }

function trimErrorPaths(str) {
  const parentDir = path.dirname(path.dirname(__dirname))

  return replaceAll(str, parentDir, '')
}

function normalizeToUnixPaths(str) {
  // TODO: Windows: this breaks some tests by replacing backslashes outside of file names.
  return replaceAll(str, path.sep, '/')
}

function normalizeGithubLinks(str) {
  return str.replace(/https:\/\/github.com\/prisma\/prisma(-client-js)?\/issues\/new\S+/, 'TEST_GITHUB_LINK')
}

function normalizeTsClientStackTrace(str) {
  return str.replace(/([/\\]client[/\\]src[/\\]__tests__[/\\].*test.ts)(:\d*:\d*)/, '$1:0:0')
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
  return str.replace(/\d{14}/g, '20201231000000')
}

function normalizeDbUrl(str) {
  return str.replace(/(localhost|postgres|mysql|mssql):\d+/g, 'localhost:5432')
}

function normalizeRustError(str) {
  return str.replace(/\/rustc\/(.+)\//g, '/rustc/hash/').replace(/(\[.*)(:\d*:\d*)(\])/g, '[/some/rust/path:0:0$3')
}

function normalizeTime(str) {
  // sometimes someting can take a few seconds when usually it's less than 1s or a few ms
  return str.replace(/ \d+ms/g, ' XXXms').replace(/ \d+(.\d+)?s/g, ' XXXms')
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
    return pipe(
      stripAnsi,
      // integration-tests pkg
      prepareSchemaForSnapshot,
      // Generic
      normalizePaths,
      // normalizeTmpDir,
      normalizeTime,
      // From Client package
      normalizeGithubLinks,
      normalizeToUnixPaths,
      normalizeBinaryFilePath,
      normalizeNodeApiLibFilePath,
      removePlatforms,
      normalizeTsClientStackTrace,
      trimErrorPaths,
      normalizePrismaPaths,
      // From Migrate/CLI package
      normalizeDbUrl,
      normalizeRustError,
      normalizeMigrateTimestamps,
    )(message)
  },
}
