const path = require('path')
const stripAnsi = require('strip-ansi')

function normalizeMigrateTimestamps(str) {
  return str.replace(/\d{14}/g, '20201231000000')
}

function normalizeDbUrl(str) {
  return str.replace(/(localhost|postgres):\d+/g, 'localhost:5432')
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
    return normalizeDbUrl(normalizeMigrateTimestamps(stripAnsi(message)))
  },
}

module.exports = serializer
