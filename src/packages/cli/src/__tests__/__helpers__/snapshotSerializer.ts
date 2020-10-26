const path = require('path')
const replaceAll = require('replace-string') // sindre's replaceAll polyfill
const stripAnsi = require('strip-ansi')
const { platforms } = require('@prisma/get-platform')
const escapeString = require('escape-string-regexp')

function trimErrorPaths(str) {
  const parentDir = path.dirname(path.dirname(__dirname))

  return replaceAll(str, parentDir, '')
}

function normalizeToUnixPaths(str) {
  return replaceAll(str, path.sep, '/')
}

const platformRegex = new RegExp(
  '(' + platforms.map((p) => escapeString(p)).join('|') + ')',
  'g',
)

function removePlatforms(str) {
  return str.replace(platformRegex, 'TEST_PLATFORM')
}

function normalizeGithubLinks(str) {
  return str.replace(
    /https:\/\/github.com\/prisma\/prisma-client-js\/issues\/\S+/,
    'TEST_GITHUB_LINK',
  )
}

function normalizeRustError(str) {
  return str
    .replace(/\/rustc\/(.+)\//g, '/rustc/hash/')
    .replace(/(\[.*)(:\d*:\d*)(\])/g, '$1:0:0$3')
}

function normalizeTmpDir(str) {
  return str.replace(/\/tmp\/([a-z0-9]+)\//g, '/tmp/dir/')
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
    return prepareSchemaForSnapshot(
      normalizeGithubLinks(
        normalizeRustError(
          normalizeTmpDir(
            normalizeGithubLinks(
              normalizeToUnixPaths(
                removePlatforms(trimErrorPaths(stripAnsi(message))),
              ),
            ),
          ),
        ),
      ),
    )
  },
}

/**
 * Replace dynamic variable bits of Prisma schema with static strings.
 */
export function prepareSchemaForSnapshot(schema: string): string {
  const urlRegex = /url\s*=\s*.+/
  const outputRegex = /output\s*=\s*.+/
  return schema
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

module.exports = serializer
