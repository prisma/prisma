import { parseArgs } from '@std/cli'

import { parseInteger } from './formats/numeric.ts'
import { parseDuration } from './formats/duration.ts'
import { parseSize } from './formats/size.ts'
import { LogLevel, parseLogLevel } from './log/log_level.ts'
import { LogFormat, parseLogFormat } from './log/format.ts'

/**
 * Configuration options for the query plan executor server.
 */
export type Options = {
  /** Database connection URL */
  databaseUrl: string
  /** Host to bind the server to */
  host: string
  /** Port to listen on */
  port: number
  /** Maximum time to wait for a query to complete */
  queryTimeout: Temporal.Duration
  /** Maximum timeout allowed for a transaction */
  maxTransactionTimeout: Temporal.Duration
  /** Maximum time to wait for a transaction to start */
  maxTransactionWaitTime: Temporal.Duration
  /** Maximum size of a response in bytes */
  maxResponseSize: number
  /** Minimum log level to output */
  logLevel: LogLevel
  /** Format of log output */
  logFormat: LogFormat
  /** Graceful shutdown timeout */
  gracefulShutdownTimeout: Temporal.Duration
}

/**
 * Environment variables accessor. Can be `Deno.env` or, e.g., `Map` in tests.
 */
type Env = {
  get(key: string): string | undefined
}

/**
 * Parses command-line arguments and environment variables into a configuration object.
 */
export function parseOptions(args: string[], env: Env): Options {
  const parsedArgs = parseArgs(args, {
    string: [
      'database-url',
      'host',
      'port',
      'query-timeout',
      'max-transaction-timeout',
      'max-transaction-wait-time',
      'max-response-size',
      'log-level',
      'log-format',
      'graceful-shutdown-timeout',
    ],
    unknown: (arg) => {
      console.warn(`Unknown argument: ${arg}`)
    },
  })

  const databaseUrl = parsedArgs['database-url'] ?? env.get('DATABASE_URL')
  if (!databaseUrl) {
    throw new Error('Either DATABASE_URL or --database-url must be provided')
  }

  const host = parsedArgs['host'] ?? env.get('HOST') ?? '0.0.0.0'
  const port = parseInteger(parsedArgs['port'] ?? env.get('PORT') ?? '8000')

  const queryTimeout = parseDuration(parsedArgs['query-timeout'] ?? env.get('QUERY_TIMEOUT') ?? 'PT5M')

  const maxTransactionTimeout = parseDuration(
    parsedArgs['max-transaction-timeout'] ?? env.get('MAX_TRANSACTION_TIMEOUT') ?? 'PT5M',
  )

  const maxTransactionWaitTime = parseDuration(
    parsedArgs['max-transaction-wait-time'] ?? env.get('MAX_TRANSACTION_WAIT_TIME') ?? 'PT2S',
  )

  const maxResponseSize = parseSize(parsedArgs['max-response-size'] ?? env.get('MAX_RESPONSE_SIZE') ?? '1GB')

  const logLevel = parseLogLevel(parsedArgs['log-level'] ?? env.get('LOG_LEVEL') ?? 'info')

  const logFormat = parseLogFormat(parsedArgs['log-format'] ?? env.get('LOG_FORMAT') ?? 'text')

  const gracefulShutdownTimeout = parseDuration(
    parsedArgs['graceful-shutdown-timeout'] ?? env.get('GRACEFUL_SHUTDOWN_TIMEOUT') ?? 'PT5S',
  )

  return {
    databaseUrl,
    host,
    port,
    queryTimeout,
    maxTransactionTimeout,
    maxTransactionWaitTime,
    maxResponseSize,
    logLevel,
    logFormat,
    gracefulShutdownTimeout,
  }
}
