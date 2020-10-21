const path = require('path')
const stripAnsi = require('strip-ansi')

function normalizeMigrateTimestamps(str) {
  return str.replace(/\d{14}/g, '20201231000000')
}

function normalizeDbUrl(str) {
  return str.replace(/(localhost|postgres):\d+/g, 'localhost:5432')
}

function normalizeRustError(str) {
  return str
    .replace(/\/rustc\/(.+)\//g, '/rustc/hash/')
    .replace(/(\[.*)(:\d*:\d*)(\])/g, '$1:0:0$3')
}

function normalizeMs(str) {
  return str.replace(/\d{2,3}ms/g, 'XXms')
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
    return normalizeDbUrl(
      normalizeMs(
        normalizeRustError(normalizeMigrateTimestamps(stripAnsi(message))),
      ),
    )
  },
}

module.exports = serializer
