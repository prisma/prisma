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
    /https:\/\/github.com\/prisma\/prisma(-client-js)?\/issues\/\S+/,
    'TEST_GITHUB_LINK',
  )
}

function normalizeTsClientStackTrace(str) {
  return str.replace(
    /(\/client\/src\/__tests__\/.*\/test.ts)(:\d*:\d*)/g,
    '$1:0:0',
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
        removePlatforms(
          normalizeTsClientStackTrace(trimErrorPaths(stripAnsi(message))),
        ),
      ),
    )
  },
}

module.exports = serializer
