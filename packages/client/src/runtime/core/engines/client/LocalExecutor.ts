import {
  type QueryEvent,
  QueryInterpreter,
  type SchemaProvider,
  type TracingHelper,
  TransactionManager,
  type TransactionOptions,
} from '@prisma/client-engine-runtime'
import type { SqlDriverAdapter, SqlDriverAdapterFactory } from '@prisma/driver-adapter-utils'

import type { InteractiveTransactionInfo } from '../common/types/Transaction'
import type { ExecutePlanParams, Executor, ProviderAndConnectionInfo } from './Executor'

export interface LocalExecutorOptions {
  driverAdapterFactory: SqlDriverAdapterFactory
  transactionOptions: TransactionOptions
  tracingHelper: TracingHelper
  onQuery?: (event: QueryEvent) => void
  provider?: SchemaProvider
}

export class LocalExecutor implements Executor {
  readonly #options: LocalExecutorOptions
  readonly #driverAdapter: SqlDriverAdapter
  readonly #transactionManager: TransactionManager

  constructor(options: LocalExecutorOptions, driverAdapter: SqlDriverAdapter, transactionManager: TransactionManager) {
    this.#options = options
    this.#driverAdapter = driverAdapter
    this.#transactionManager = transactionManager
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
    const connectionInfo = this.#driverAdapter.getConnectionInfo?.() ?? { supportsRelationJoins: false }
    return Promise.resolve({ provider: this.#driverAdapter.provider, connectionInfo })
  }

  async execute({ plan, placeholderValues, transaction, batchIndex }: ExecutePlanParams): Promise<unknown> {
    const queryable = transaction
      ? this.#transactionManager.getTransaction(transaction, batchIndex !== undefined ? 'batch query' : 'query')
      : this.#driverAdapter

    const interpreter = QueryInterpreter.forSql({
      transactionManager: transaction ? { enabled: false } : { enabled: true, manager: this.#transactionManager },
      placeholderValues,
      onQuery: this.#options.onQuery,
      tracingHelper: this.#options.tracingHelper,
      provider: this.#options.provider,
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
}
