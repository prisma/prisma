import { describe, expect, test } from 'vitest'

import { parseClientTelemetryHeader } from './client-telemetry'

describe('parseClientTelemetryHeader', () => {
  test('empty', () => {
    expect(parseClientTelemetryHeader('')).toEqual({
      spans: false,
      logLevels: [],
    })
  })

  test('spans', () => {
    expect(parseClientTelemetryHeader('spans')).toEqual({
      spans: true,
      logLevels: [],
    })
  })

  test('all log levels', () => {
    expect(parseClientTelemetryHeader('debug,query,info,warn,error')).toEqual({
      spans: false,
      logLevels: ['debug', 'query', 'info', 'warn', 'error'],
    })

    expect(parseClientTelemetryHeader('debug, query, info, warn, error')).toEqual({
      spans: false,
      logLevels: ['debug', 'query', 'info', 'warn', 'error'],
    })
  })

  test('mixed', () => {
    expect(parseClientTelemetryHeader('info,spans')).toEqual({
      spans: true,
      logLevels: ['info'],
    })

    expect(parseClientTelemetryHeader('spans,info,warn,error')).toEqual({
      spans: true,
      logLevels: ['info', 'warn', 'error'],
    })
  })

  test('invalid levels', () => {
    expect(() => parseClientTelemetryHeader('invalid')).toThrow()
    expect(() => parseClientTelemetryHeader('invalid,info')).toThrow()
    expect(() => parseClientTelemetryHeader('spans,invalid')).toThrow()
  })
})
