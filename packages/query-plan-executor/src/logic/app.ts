import { AttributeValue } from '@opentelemetry/api'
import {
  normalizeJsonProtocolValues,
  QueryInterpreter,
  QueryPlanNode,
  safeJsonStringify,
  TransactionInfo,
  TransactionManager,
  TransactionOptions,
} from '@prisma/client-engine-runtime'
import { ConnectionInfo, Provider, SqlDriverAdapter } from '@prisma/driver-adapter-utils'
import { deadline } from '@std/async/deadline'

import { Options } from '../options.ts'
import { ResourceLimitError, ResourceLimits } from './resource_limits.ts'
import { TracingHandler } from '../tracing/handler.ts'
import { runInActiveSpan, tracer } from '../tracing/tracer.ts'
import * as log from '../log/facade.ts'
import { createAdapter } from './adapter.ts'

const TIMEOUT_EXIT_CODE = 124

/**
 * Entry point for the application logic.
 */
export class App {
  readonly #db: SqlDriverAdapter
  readonly #transactionManager: TransactionManager
  readonly #tracingHandler: TracingHandler

  constructor(db: SqlDriverAdapter, transactionManager: TransactionManager, tracingHandler: TracingHandler) {
    this.#db = db
    this.#transactionManager = transactionManager
    this.#tracingHandler = tracingHandler
  }

  /**
   * Connects to the database and initializes the application logic.
   */
  static async start(options: Options): Promise<App> {
    const connector = createAdapter(options.databaseUrl)

    const db = await runInActiveSpan('connect', () => connector.connect())

    const tracingHandler = new TracingHandler(tracer)

    const transactionManager = new TransactionManager({
      driverAdapter: db,
      transactionOptions: {
        timeout: options.maxTransactionTimeout.total('milliseconds'),
        maxWait: options.maxTransactionWaitTime.total('milliseconds'),
      },
      tracingHelper: tracingHandler,
    })

    registerShutdownSignalHandlers(transactionManager, db, options)

    return new App(db, transactionManager, tracingHandler)
  }

  /**
   * Executes a query plan and returns the result.
   */
  async query(
    queryPlan: QueryPlanNode,
    placeholderValues: Record<string, unknown>,
    resourceLimits: ResourceLimits,
    transactionId: string | null,
  ): Promise<unknown> {
    return await this.#tracingHandler.runInChildSpan('query', async () => {
      const queryable =
        transactionId !== null
          ? await this.#transactionManager.getTransaction({ id: transactionId }, 'query')
          : this.#db

      const queryInterpreter = QueryInterpreter.forSql({
        placeholderValues,
        tracingHelper: this.#tracingHandler,
        transactionManager:
          transactionId !== null ? { enabled: true, manager: this.#transactionManager } : { enabled: false },
        onQuery: (event) => {
          log.query('Query', {
            ...event,
            timestamp: Number(event.timestamp),
            params: serializeParamsForLogging(event.params),
          })
        },
      })

      try {
        const result = await deadline(
          queryInterpreter.run(queryPlan, queryable),
          resourceLimits.queryTimeout.total('milliseconds'),
        )
        return normalizeJsonProtocolValues(result)
      } catch (error) {
        if (error instanceof DOMException) {
          throw new ResourceLimitError('Query timeout exceeded')
        } else {
          throw error
        }
      }
    })
  }

  /**
   * Starts a new transaction.
   */
  async startTransaction(options: TransactionOptions, resourceLimits: ResourceLimits): Promise<TransactionInfo> {
    return await this.#tracingHandler.runInChildSpan('start_transaction', () => {
      const timeout = Math.min(options.timeout ?? Infinity, resourceLimits.maxTransactionTimeout.total('milliseconds'))

      return this.#transactionManager.startTransaction({
        ...options,
        timeout,
      })
    })
  }

  /**
   * Commits a transaction.
   */
  async commitTransaction(transactionId: string): Promise<void> {
    return await this.#tracingHandler.runInChildSpan('commit_transaction', () =>
      this.#transactionManager.commitTransaction(transactionId),
    )
  }

  /**
   * Rolls back a transaction.
   */
  async rollbackTransaction(transactionId: string): Promise<void> {
    return await this.#tracingHandler.runInChildSpan('rollback_transaction', () =>
      this.#transactionManager.rollbackTransaction(transactionId),
    )
  }

  /**
   * Retrieves connection information necessary for building the queries.
   */
  getConnectionInfo(): { provider: Provider; connectionInfo: ConnectionInfo } {
    const connectionInfo = this.#db.getConnectionInfo?.() ?? {
      supportsRelationJoins: false,
    }
    return { provider: this.#db.provider, connectionInfo }
  }
}

function serializeParamsForLogging(params: unknown[]): AttributeValue {
  return params.map((param) => {
    if (Array.isArray(param)) {
      return serializeParamsForLogging(param)
    }
    if (!['string', 'number', 'boolean'].includes(typeof param)) {
      return safeJsonStringify(param)
    }
    return param
  }) as AttributeValue
}

function registerShutdownSignalHandlers(
  transactionManager: TransactionManager,
  db: SqlDriverAdapter,
  options: Options,
) {
  let shutdownInProgress = false

  const gracefulShutdown = async () => {
    const terminate = async () => {
      try {
        await transactionManager.cancelAllTransactions()
      } finally {
        await db.dispose()
      }
    }

    try {
      await deadline(terminate(), options.gracefulShutdownTimeout.total('milliseconds'))
    } catch (err) {
      if (err instanceof DOMException && err.name === 'TimeoutError') {
        log.info('Graceful shutdown timed out')
        Deno.exit(TIMEOUT_EXIT_CODE)
      }
      throw err
    }

    Deno.exit()
  }

  const addSignalHandler = (signal: Deno.Signal) => {
    Deno.addSignalListener(signal, () => {
      if (!shutdownInProgress) {
        log.info(`Received ${signal} signal, shutting down`)
        shutdownInProgress = true
        void gracefulShutdown()
      }
    })
  }

  addSignalHandler('SIGINT')
  addSignalHandler('SIGTERM')
}
