import {
  type QueryEvent,
  QueryInterpreter,
  type QueryInterpreterSqlCommenter,
  type QueryInterpreterTransactionManager,
  type SchemaProvider,
  type TracingHelper,
  TransactionManager,
  type TransactionOptions,
} from '@prisma/client-engine-runtime'
import type { ConnectionInfo, SqlDriverAdapter, SqlDriverAdapterFactory } from '@prisma/driver-adapter-utils'
import type { SqlCommenterPlugin } from '@prisma/sqlcommenter'

import type { InteractiveTransactionInfo } from '../common/types/Transaction'
import type { ExecutePlanParams, Executor, ProviderAndConnectionInfo } from './Executor'

const DISABLED_TRANSACTION_MANAGER = { enabled: false } satisfies QueryInterpreterTransactionManager

export interface LocalExecutorOptions {
  driverAdapterFactory: SqlDriverAdapterFactory
  transactionOptions: TransactionOptions
  tracingHelper: TracingHelper
  onQuery?: (event: QueryEvent) => void
  provider?: SchemaProvider
  sqlCommenters?: SqlCommenterPlugin[]
}

export class LocalExecutor implements Executor {
  readonly resultFormat = 'js'

  readonly #options: LocalExecutorOptions
  readonly #driverAdapter: SqlDriverAdapter
  readonly #transactionManager: TransactionManager
  readonly #queryTransactionManager: QueryInterpreterTransactionManager
  readonly #connectionInfo?: ConnectionInfo
  readonly #interpreter: QueryInterpreter

  constructor(options: LocalExecutorOptions, driverAdapter: SqlDriverAdapter, transactionManager: TransactionManager) {
    this.#options = options
    this.#driverAdapter = driverAdapter
    this.#transactionManager = transactionManager
    this.#queryTransactionManager = { enabled: true, manager: transactionManager }
    this.#connectionInfo = driverAdapter.getConnectionInfo?.()
    this.#interpreter = QueryInterpreter.forSql({
      onQuery: this.#options.onQuery,
      tracingHelper: this.#options.tracingHelper,
      provider: this.#options.provider,
      connectionInfo: this.#connectionInfo,
      resultFormat: this.resultFormat,
    })
  }

  static async connect(options: LocalExecutorOptions): Promise<LocalExecutor> {
    let driverAdapter: SqlDriverAdapter | undefined = undefined
    let transactionManager: TransactionManager | undefined = undefined

    try {
      driverAdapter = await options.driverAdapterFactory.connect()
      transactionManager = new TransactionManager({
        driverAdapter,
        transactionOptions: options.transactionOptions,
        tracingHelper: options.tracingHelper,
        onQuery: options.onQuery,
        provider: options.provider,
      })
    } catch (error) {
      await driverAdapter?.dispose()
      throw error
    }

    return new LocalExecutor(options, driverAdapter, transactionManager)
  }

  getConnectionInfo(): Promise<ProviderAndConnectionInfo> {
    const connectionInfo = this.#connectionInfo ?? { supportsRelationJoins: false }
    return Promise.resolve({ provider: this.#driverAdapter.provider, connectionInfo })
  }

  execute({ plan, placeholderValues: scope, transaction, batchIndex, queryInfo }: ExecutePlanParams): Promise<unknown> {
    const sqlCommenter =
      this.#options.sqlCommenters !== undefined && queryInfo !== undefined
        ? { plugins: this.#options.sqlCommenters, queryInfo }
        : undefined

    if (transaction !== undefined) {
      return this.#executeInTransaction(plan, scope, transaction, batchIndex, sqlCommenter)
    }

    return this.#interpreter.run(plan, {
      queryable: this.#driverAdapter,
      transactionManager: this.#queryTransactionManager,
      scope,
      sqlCommenter,
    })
  }

  async #executeInTransaction(
    plan: ExecutePlanParams['plan'],
    scope: ExecutePlanParams['placeholderValues'],
    transaction: InteractiveTransactionInfo,
    batchIndex: ExecutePlanParams['batchIndex'],
    sqlCommenter: QueryInterpreterSqlCommenter | undefined,
  ): Promise<unknown> {
    const queryable = await this.#transactionManager.getTransaction(
      transaction,
      batchIndex !== undefined ? 'batch query' : 'query',
    )

    return this.#interpreter.run(plan, {
      queryable,
      transactionManager: DISABLED_TRANSACTION_MANAGER,
      scope,
      sqlCommenter,
    })
  }

  async startTransaction(options: TransactionOptions): Promise<InteractiveTransactionInfo> {
    return { ...(await this.#transactionManager.startTransaction(options)), payload: undefined }
  }

  async commitTransaction(transaction: InteractiveTransactionInfo): Promise<void> {
    await this.#transactionManager.commitTransaction(transaction.id)
  }

  async rollbackTransaction(transaction: InteractiveTransactionInfo): Promise<void> {
    await this.#transactionManager.rollbackTransaction(transaction.id)
  }

  async disconnect(): Promise<void> {
    try {
      await this.#transactionManager.cancelAllTransactions()
    } finally {
      await this.#driverAdapter.dispose()
    }
  }

  apiKey(): string | null {
    return null
  }
}
