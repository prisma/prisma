const path = require('path')
const replaceAll = require('replace-string') // sindre's replaceAll polyfill
const stripAnsi = require('strip-ansi')
const { platformRegex } = require('@prisma/sdk')

function trimErrorPaths(str) {
  const parentDir = path.dirname(path.dirname(__dirname))

  return replaceAll(str, parentDir, '')
}

function normalizeToUnixPaths(str) {
  // TODO: Windows: this breaks some tests by replacing backslashes outside of file names.
  return replaceAll(str, path.sep, '/')
}

function removePlatforms(str) {
  return str.replace(platformRegex, 'TEST_PLATFORM')
}

function normalizeGithubLinks(str) {
  return str.replace(/https:\/\/github.com\/prisma\/prisma(-client-js)?\/issues\/\S+/, 'TEST_GITHUB_LINK')
}

function normalizeTsClientStackTrace(str) {
  return str.replace(/([/\\]client[/\\]src[/\\]__tests__[/\\].*test.ts)(:\d*:\d*)/, '$1:0:0')
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

const serializer = {
  test(value) {
    return typeof value === 'string' || value instanceof Error
  },
  serialize(value) {
    const message = typeof value === 'string' ? value : value instanceof Error ? value.message : ''
    // TODO: consider introducing a helper function like pipe or compose
    return normalizeGithubLinks(
      normalizeToUnixPaths(
        normalizeBinaryFilePath(
          normalizeNodeApiLibFilePath(removePlatforms(normalizeTsClientStackTrace(trimErrorPaths(stripAnsi(message))))),
        ),
      ),
    )
  },
}

module.exports = serializer
