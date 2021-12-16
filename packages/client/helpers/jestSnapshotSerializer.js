const path = require('path')
const replaceAll = require('replace-string') // sindre's replaceAll polyfill
const stripAnsi = require('strip-ansi')
const { platformRegex } = require('@prisma/sdk')

function trimErrorPaths(str) {
  const parentDir = path.dirname(path.dirname(__dirname))

  return replaceAll(str, parentDir, '')
}

function normalizeToUnixPaths(str) {
  return replaceAll(str, path.sep, '/')
}

function removePlatforms(str) {
  return str.replace(platformRegex, 'TEST_PLATFORM')
}

function normalizeGithubLinks(str) {
  return str.replace(
    /https:\/\/github.com\/prisma\/prisma(-client-js)?\/issues\/\S+/,
    'TEST_GITHUB_LINK',
  )
}

function normalizeTsClientStackTrace(str) {
  return str.replace(
    /(\/client\/src\/__tests__\/.*test.ts)(:\d*:\d*)/,
    '$1:0:0',
  )
}

// When updating snapshots this is sensitive to OS
// macOS will update extension to .dylib.node, but CI uses .so.node for example
function normalizeNodeApiLibFilePath(str) {
  return str.replace(
    /(libquery_engine-TEST_PLATFORM.)(.*)(.node)/,
    '$1LIBRARY_TYPE$3',
  )
}

const serializer = {
  test(value) {
    return typeof value === 'string' || value instanceof Error
  },
  serialize(value) {
    const message =
      typeof value === 'string'
        ? value
        : value instanceof Error
        ? value.message
        : ''
    return normalizeGithubLinks(
      normalizeToUnixPaths(
        normalizeNodeApiLibFilePath(
          removePlatforms(
            normalizeTsClientStackTrace(trimErrorPaths(stripAnsi(message))),
          ),
        ),
      ),
    )
  },
}

module.exports = serializer
