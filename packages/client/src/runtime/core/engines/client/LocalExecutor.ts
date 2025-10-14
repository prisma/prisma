import {
  type QueryEvent,
  QueryInterpreter,
  type SchemaProvider,
  type TracingHelper,
  TransactionManager,
  type TransactionOptions,
} from '@prisma/client-engine-runtime'
import type { ConnectionInfo, SqlDriver, SqlDriverFactory } from '@prisma/driver-utils'

import type { InteractiveTransactionInfo } from '../common/types/Transaction'
import type { ExecutePlanParams, Executor, ProviderAndConnectionInfo } from './Executor'

export interface LocalExecutorOptions {
  driverFactory: SqlDriverFactory
  transactionOptions: TransactionOptions
  tracingHelper: TracingHelper
  onQuery?: (event: QueryEvent) => void
  provider?: SchemaProvider
}

export class LocalExecutor implements Executor {
  readonly #options: LocalExecutorOptions
  readonly #driverAdapter: SqlDriver
  readonly #transactionManager: TransactionManager
  readonly #connectionInfo?: ConnectionInfo

  constructor(options: LocalExecutorOptions, driverAdapter: SqlDriver, transactionManager: TransactionManager) {
    this.#options = options
    this.#driverAdapter = driverAdapter
    this.#transactionManager = transactionManager
    this.#connectionInfo = driverAdapter.getConnectionInfo?.()
  }

  static async connect(options: LocalExecutorOptions): Promise<LocalExecutor> {
    let driverAdapter: SqlDriver | undefined = undefined
    let transactionManager: TransactionManager | undefined = undefined

    try {
      driverAdapter = await options.driverFactory.connect()
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

  async execute({ plan, placeholderValues, transaction, batchIndex }: ExecutePlanParams): Promise<unknown> {
    const queryable = transaction
      ? await this.#transactionManager.getTransaction(transaction, batchIndex !== undefined ? 'batch query' : 'query')
      : this.#driverAdapter

    const interpreter = QueryInterpreter.forSql({
      transactionManager: transaction ? { enabled: false } : { enabled: true, manager: this.#transactionManager },
      placeholderValues,
      onQuery: this.#options.onQuery,
      tracingHelper: this.#options.tracingHelper,
      provider: this.#options.provider,
      connectionInfo: this.#connectionInfo,
    })

    return await interpreter.run(plan, queryable)
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
