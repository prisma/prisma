import { Debug } from '@prisma/debug'
import { SqlDriverAdapter, SqlQuery, SqlQueryable, Transaction } from '@prisma/driver-adapter-utils'

import { randomUUID } from '../crypto'
import { QueryEvent } from '../events'
import type { SchemaProvider } from '../schema'
import { TracingHelper, withQuerySpanAndEvent } from '../tracing'
import { rethrowAsUserFacing } from '../user-facing-error'
import { assertNever } from '../utils'
import { once } from '../web-platform'
import { Options, TransactionInfo } from './transaction'
import {
  InvalidTransactionIsolationLevelError,
  TransactionClosedError,
  TransactionExecutionTimeoutError,
  TransactionInternalConsistencyError,
  TransactionManagerError,
  TransactionNotFoundError,
  TransactionRolledBackError,
  TransactionStartTimeoutError,
} from './transaction-manager-error'

const MAX_CLOSED_TRANSACTIONS = 100

type TransactionWrapper = {
  id: string
  timer?: NodeJS.Timeout
  timeout: number | undefined
  startedAt: number
  transaction?: Transaction
} & TransactionState

type TransactionState =
  | { status: 'waiting' | 'running' | 'committed' | 'rolled_back' | 'timed_out' }
  | { status: 'closing'; closing: Promise<void>; reason: 'committed' | 'rolled_back' | 'timed_out' }

const debug = Debug('prisma:client:transactionManager')

const COMMIT_QUERY = (): SqlQuery => ({ sql: 'COMMIT', args: [], argTypes: [] })
const ROLLBACK_QUERY = (): SqlQuery => ({ sql: 'ROLLBACK', args: [], argTypes: [] })

const PHANTOM_COMMIT_QUERY = (): SqlQuery => ({
  sql: '-- Implicit "COMMIT" query via underlying driver',
  args: [],
  argTypes: [],
})
const PHANTOM_ROLLBACK_QUERY = (): SqlQuery => ({
  sql: '-- Implicit "ROLLBACK" query via underlying driver',
  args: [],
  argTypes: [],
})

export class TransactionManager {
  // The map of active transactions.
  private transactions: Map<string, TransactionWrapper> = new Map()
  // List of last closed transactions. Max MAX_CLOSED_TRANSACTIONS entries.
  // Used to provide better error messages than a generic "transaction not found".
  private closedTransactions: TransactionWrapper[] = []
  private readonly driverAdapter: SqlDriverAdapter
  private readonly transactionOptions: Options
  private readonly tracingHelper: TracingHelper
  readonly #onQuery?: (event: QueryEvent) => void
  readonly #provider?: SchemaProvider

  constructor({
    driverAdapter,
    transactionOptions,
    tracingHelper,
    onQuery,
    provider,
  }: {
    driverAdapter: SqlDriverAdapter
    transactionOptions: Options
    tracingHelper: TracingHelper
    onQuery?: (event: QueryEvent) => void
    provider?: SchemaProvider
  }) {
    this.driverAdapter = driverAdapter
    this.transactionOptions = transactionOptions
    this.tracingHelper = tracingHelper
    this.#onQuery = onQuery
    this.#provider = provider
  }

  /**
   * Starts an internal transaction. The difference to `startTransaction` is that it does not
   * use the default transaction options from the `TransactionManager`, which in practice means
   * that it does not apply the default timeouts.
   */
  async startInternalTransaction(options?: Options): Promise<TransactionInfo> {
    const validatedOptions = options !== undefined ? this.#validateOptions(options) : {}
    return await this.tracingHelper.runInChildSpan('start_transaction', () =>
      this.#startTransactionImpl(validatedOptions),
    )
  }

  async startTransaction(options?: Options): Promise<TransactionInfo> {
    const validatedOptions = options !== undefined ? this.#validateOptions(options) : this.transactionOptions
    return await this.tracingHelper.runInChildSpan('start_transaction', () =>
      this.#startTransactionImpl(validatedOptions),
    )
  }

  async #startTransactionImpl(options: Options): Promise<TransactionInfo> {
    const transaction: TransactionWrapper = {
      id: await randomUUID(),
      status: 'waiting',
      timer: undefined,
      timeout: options.timeout,
      startedAt: Date.now(),
      transaction: undefined,
    }

    // Start timeout to wait for transaction to be started.
    const abortController = new AbortController()
    const startTimer = createTimeoutIfDefined(() => abortController.abort(), options.maxWait)
    startTimer?.unref?.()

    // Keep a reference to the startTransaction promise so we can clean up
    // if the timeout fires before it completes.
    const startTransactionPromise = this.driverAdapter
      .startTransaction(options.isolationLevel)
      .catch(rethrowAsUserFacing)

    transaction.transaction = await Promise.race([
      startTransactionPromise.finally(() => clearTimeout(startTimer)),
      once(abortController.signal, 'abort').then(() => undefined),
    ])

    this.transactions.set(transaction.id, transaction)

    // Transaction status might have timed out while waiting for transaction to start. => Check for it!
    switch (transaction.status) {
      case 'waiting':
        if (abortController.signal.aborted) {
          // The startTransaction promise may still be running in the background.
          // If it eventually succeeds, we need to release the connection to avoid
          // leaking it and exhausting the connection pool. We ignore any errors
          // that happen during startup or rollback here because we will have
          // already returned our own `TransactionStartTimeoutError` error to the user.
          void startTransactionPromise
            .then((tx) => tx.rollback())
            .catch((e) => debug('error in discarded transaction:', e))

          // Call `#closeTransaction` to update internal state. It won't actually attempt
          // to rollback the tx itself because `transaction.transaction` is undefined.
          await this.#closeTransaction(transaction, 'timed_out')

          throw new TransactionStartTimeoutError()
        }

        transaction.status = 'running'
        // Start timeout to wait for transaction to be finished.
        transaction.timer = this.#startTransactionTimeout(transaction.id, options.timeout)
        return { id: transaction.id }
      case 'timed_out':
      case 'running':
      case 'committed':
      case 'rolled_back':
        throw new TransactionInternalConsistencyError(
          `Transaction in invalid state ${transaction.status} although it just finished startup.`,
        )
      default:
        assertNever(transaction['status'], 'Unknown transaction status.')
    }
  }

  async commitTransaction(transactionId: string): Promise<void> {
    return await this.tracingHelper.runInChildSpan('commit_transaction', async () => {
      const txw = this.#getActiveOrClosingTransaction(transactionId, 'commit')
      await this.#closeTransaction(txw, 'committed')
    })
  }

  async rollbackTransaction(transactionId: string): Promise<void> {
    return await this.tracingHelper.runInChildSpan('rollback_transaction', async () => {
      const txw = this.#getActiveOrClosingTransaction(transactionId, 'rollback')
      await this.#closeTransaction(txw, 'rolled_back')
    })
  }

  async getTransaction(txInfo: TransactionInfo, operation: string): Promise<Transaction> {
    let tx = this.#getActiveOrClosingTransaction(txInfo.id, operation)
    if (tx.status === 'closing') {
      await tx.closing
      // Fetch again to ensure proper error propagation after it's been closed.
      tx = this.#getActiveOrClosingTransaction(txInfo.id, operation)
    }
    if (!tx.transaction) throw new TransactionNotFoundError()
    return tx.transaction
  }

  #getActiveOrClosingTransaction(transactionId: string, operation: string): TransactionWrapper {
    const transaction = this.transactions.get(transactionId)

    if (!transaction) {
      const closedTransaction = this.closedTransactions.find((tx) => tx.id === transactionId)
      if (closedTransaction) {
        debug('Transaction already closed.', { transactionId, status: closedTransaction.status })
        switch (closedTransaction.status) {
          case 'closing':
          case 'waiting':
          case 'running':
            throw new TransactionInternalConsistencyError('Active transaction found in closed transactions list.')
          case 'committed':
            throw new TransactionClosedError(operation)
          case 'rolled_back':
            throw new TransactionRolledBackError(operation)
          case 'timed_out':
            throw new TransactionExecutionTimeoutError(operation, {
              timeout: closedTransaction.timeout!,
              timeTaken: Date.now() - closedTransaction.startedAt,
            })
        }
      } else {
        debug(`Transaction not found.`, transactionId)
        throw new TransactionNotFoundError()
      }
    }

    if (['committed', 'rolled_back', 'timed_out'].includes(transaction.status)) {
      throw new TransactionInternalConsistencyError('Closed transaction found in active transactions map.')
    }

    return transaction
  }

  async cancelAllTransactions(): Promise<void> {
    // TODO: call `map` on the iterator directly without collecting it into an array first
    // once we drop support for Node.js 18 and 20.
    await Promise.allSettled([...this.transactions.values()].map((tx) => this.#closeTransaction(tx, 'rolled_back')))
  }

  #startTransactionTimeout(transactionId: string, timeout: number | undefined): NodeJS.Timeout | undefined {
    const timeoutStartedAt = Date.now()
    const timer = createTimeoutIfDefined(async () => {
      debug('Transaction timed out.', { transactionId, timeoutStartedAt, timeout })

      const tx = this.transactions.get(transactionId)
      if (tx && ['running', 'waiting'].includes(tx.status)) {
        await this.#closeTransaction(tx, 'timed_out')
      } else {
        // Transaction was already committed or rolled back when timeout happened.
        // Should normally not happen as timeout is cancelled when transaction is committed or rolled back.
        // No further action needed though.
        debug('Transaction already committed or rolled back when timeout happened.', transactionId)
      }
    }, timeout)

    timer?.unref?.()
    return timer
  }

  async #closeTransaction(tx: TransactionWrapper, status: 'committed' | 'rolled_back' | 'timed_out'): Promise<void> {
    const createClosingPromise = async () => {
      debug('Closing transaction.', { transactionId: tx.id, status })
      try {
        if (tx.transaction && status === 'committed') {
          if (tx.transaction.options.usePhantomQuery) {
            await this.#withQuerySpanAndEvent(PHANTOM_COMMIT_QUERY(), tx.transaction, () => tx.transaction!.commit())
          } else {
            const query = COMMIT_QUERY()
            await this.#withQuerySpanAndEvent(query, tx.transaction, () => tx.transaction!.executeRaw(query)).then(
              () => tx.transaction!.commit(),
              (err) => {
                const fail = () => Promise.reject(err)
                return tx.transaction!.rollback().then(fail, fail)
              },
            )
          }
        } else if (tx.transaction) {
          if (tx.transaction.options.usePhantomQuery) {
            await this.#withQuerySpanAndEvent(PHANTOM_ROLLBACK_QUERY(), tx.transaction, () =>
              tx.transaction!.rollback(),
            )
          } else {
            const query = ROLLBACK_QUERY()
            try {
              await this.#withQuerySpanAndEvent(query, tx.transaction, () => tx.transaction!.executeRaw(query))
            } finally {
              await tx.transaction.rollback()
            }
          }
        }
      } finally {
        tx.status = status
        clearTimeout(tx.timer)
        tx.timer = undefined

        this.transactions.delete(tx.id)

        this.closedTransactions.push(tx)
        if (this.closedTransactions.length > MAX_CLOSED_TRANSACTIONS) {
          this.closedTransactions.shift()
        }
      }
    }

    if (tx.status === 'closing') {
      await tx.closing
      // Fetch again to ensure proper error propagation after it's been closed.
      this.#getActiveOrClosingTransaction(tx.id, status === 'committed' ? 'commit' : 'rollback')
    } else {
      await Object.assign(tx, {
        status: 'closing',
        reason: status,
        closing: createClosingPromise(),
      }).closing
    }
  }

  #validateOptions(options: Options) {
    // Supplying timeout default values is cared for upstream already.
    if (!options.timeout) throw new TransactionManagerError('timeout is required')
    if (!options.maxWait) throw new TransactionManagerError('maxWait is required')

    // Snapshot level only supported for MS SQL Server, which is not supported via driver adapters so far.
    if (options.isolationLevel === 'SNAPSHOT') throw new InvalidTransactionIsolationLevelError(options.isolationLevel)

    return {
      ...options,
      timeout: options.timeout,
      maxWait: options.maxWait,
    }
  }

  #withQuerySpanAndEvent<T>(query: SqlQuery, queryable: SqlQueryable, execute: () => Promise<T>): Promise<T> {
    return withQuerySpanAndEvent({
      query,
      execute,
      provider: this.#provider ?? queryable.provider,
      tracingHelper: this.tracingHelper,
      onQuery: this.#onQuery,
    })
  }
}

function createTimeoutIfDefined(cb: () => void, ms: number | undefined): NodeJS.Timeout | undefined {
  return ms !== undefined ? setTimeout(cb, ms) : undefined
}
