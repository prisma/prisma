import timers from 'node:timers/promises'

import {
  normalizeJsonProtocolValues,
  QueryEvent,
  QueryInterpreter,
  QueryPlanNode,
  safeJsonStringify,
  TransactionInfo,
  TransactionManager,
  TransactionOptions,
} from '@prisma/client-engine-runtime'
import { ConnectionInfo, Provider, SqlDriverAdapter } from '@prisma/driver-adapter-utils'

import * as log from '../log/facade'
import { Options } from '../options'
import { TracingHandler } from '../tracing/handler'
import { runInActiveSpan, tracer } from '../tracing/tracer'
import { createAdapter } from './adapter'
import { ResourceLimitError, ResourceLimits } from './resource-limits'

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
      onQuery: logQuery,
    })

    return new App(db, transactionManager, tracingHandler)
  }

  /**
   * Cancels all active transactions and disconnects from the database.
   */
  async shutdown(): Promise<void> {
    try {
      await this.#transactionManager.cancelAllTransactions()
    } finally {
      await this.#db.dispose()
    }
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
        onQuery: logQuery,
      })

      const result = await Promise.race([
        queryInterpreter.run(queryPlan, queryable),
        timers.setTimeout(resourceLimits.queryTimeout.total('milliseconds'), undefined, { ref: false }).then(() => {
          throw new ResourceLimitError('Query timeout exceeded')
        }),
      ])

      return normalizeJsonProtocolValues(result)
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
    const connectionInfo = this.#db.getConnectionInfo?.() ?? { supportsRelationJoins: false }
    return { provider: this.#db.provider, connectionInfo }
  }
}

function logQuery(event: QueryEvent): void {
  log.query('Query', {
    ...event,
    timestamp: Number(event.timestamp),
    params: safeJsonStringify(event.params),
  })
}
