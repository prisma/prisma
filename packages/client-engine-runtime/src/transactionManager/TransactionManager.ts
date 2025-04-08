import { Debug } from '@prisma/debug'
import { SqlDriverAdapter, SqlQuery, Transaction } from '@prisma/driver-adapter-utils'

import { randomUUID } from '../crypto'
import { assertNever } from '../utils'
import { Options, TransactionInfo } from './Transaction'
import {
  InvalidTransactionIsolationLevelError,
  TransactionClosedError,
  TransactionExecutionTimeoutError,
  TransactionInternalConsistencyError,
  TransactionManagerError,
  TransactionNotFoundError,
  TransactionRolledBackError,
  TransactionStartTimeoutError,
} from './TransactionManagerErrors'

const MAX_CLOSED_TRANSACTIONS = 100

type TransactionWrapper = {
  id: string
  status: 'waiting' | 'running' | 'committed' | 'rolled_back' | 'timed_out'
  timer?: NodeJS.Timeout
  timeout: number
  startedAt: number
  transaction?: Transaction
}

const debug = Debug('prisma:client:transactionManager')

const COMMIT_QUERY = (): SqlQuery => ({ sql: 'COMMIT', args: [], argTypes: [] })
const ROLLBACK_QUERY = (): SqlQuery => ({ sql: 'ROLLBACK', args: [], argTypes: [] })

export class TransactionManager {
  // The map of active transactions.
  private transactions: Map<string, TransactionWrapper> = new Map()
  // List of last closed transactions. Max MAX_CLOSED_TRANSACTIONS entries.
  // Used to provide better error messages than a generic "transaction not found".
  private closedTransactions: TransactionWrapper[] = []
  private readonly driverAdapter: SqlDriverAdapter
  private readonly transactionOptions: Options

  constructor({ driverAdapter, transactionOptions }: { driverAdapter: SqlDriverAdapter; transactionOptions: Options }) {
    this.driverAdapter = driverAdapter
    this.transactionOptions = transactionOptions
  }

  async startTransaction(options?: Options): Promise<TransactionInfo> {
    const validatedOptions = options !== undefined ? this.validateOptions(options) : this.transactionOptions

    const transaction: TransactionWrapper = {
      id: await randomUUID(),
      status: 'waiting',
      timer: undefined,
      timeout: validatedOptions.timeout!,
      startedAt: Date.now(),
      transaction: undefined,
    }
    this.transactions.set(transaction.id, transaction)

    // Start timeout to wait for transaction to be started.
    transaction.timer = this.startTransactionTimeout(transaction.id, validatedOptions.maxWait!)

    const startedTransaction = await this.driverAdapter.startTransaction(validatedOptions.isolationLevel)

    // Transaction status might have changed to timed_out while waiting for transaction to start. => Check for it!
    switch (transaction.status) {
      case 'waiting':
        transaction.transaction = startedTransaction
        clearTimeout(transaction.timer)
        transaction.timer = undefined
        transaction.status = 'running'

        // Start timeout to wait for transaction to be finished.
        transaction.timer = this.startTransactionTimeout(transaction.id, validatedOptions.timeout!)

        return { id: transaction.id }
      case 'timed_out':
        throw new TransactionStartTimeoutError()
      case 'running':
      case 'committed':
      case 'rolled_back':
        throw new TransactionInternalConsistencyError(
          `Transaction in invalid state ${transaction.status} although it just finished startup.`,
        )
      default:
        assertNever(transaction.status, 'Unknown transaction status.')
    }
  }

  async commitTransaction(transactionId: string): Promise<void> {
    const txw = this.getActiveTransaction(transactionId, 'commit')
    await this.closeTransaction(txw, 'committed')
  }

  async rollbackTransaction(transactionId: string): Promise<void> {
    const txw = this.getActiveTransaction(transactionId, 'rollback')
    await this.closeTransaction(txw, 'rolled_back')
  }

  getTransaction(txInfo: TransactionInfo, operation: string): Transaction {
    const tx = this.getActiveTransaction(txInfo.id, operation)
    if (!tx.transaction) throw new TransactionNotFoundError()
    return tx.transaction
  }

  private getActiveTransaction(transactionId: string, operation: string): TransactionWrapper {
    const transaction = this.transactions.get(transactionId)

    if (!transaction) {
      const closedTransaction = this.closedTransactions.find((tx) => tx.id === transactionId)
      if (closedTransaction) {
        debug('Transaction already closed.', { transactionId, status: closedTransaction.status })
        switch (closedTransaction.status) {
          case 'waiting':
          case 'running':
            throw new TransactionInternalConsistencyError('Active transaction found in closed transactions list.')
          case 'committed':
            throw new TransactionClosedError(operation)
          case 'rolled_back':
            throw new TransactionRolledBackError(operation)
          case 'timed_out':
            throw new TransactionExecutionTimeoutError(operation, {
              timeout: closedTransaction.timeout,
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
    await Promise.allSettled([...this.transactions.values()].map((tx) => this.closeTransaction(tx, 'rolled_back')))
  }

  private startTransactionTimeout(transactionId: string, timeout: number): NodeJS.Timeout {
    const timeoutStartedAt = Date.now()
    return setTimeout(async () => {
      debug('Transaction timed out.', { transactionId, timeoutStartedAt, timeout })

      const tx = this.transactions.get(transactionId)
      if (tx && ['running', 'waiting'].includes(tx.status)) {
        await this.closeTransaction(tx, 'timed_out')
      } else {
        // Transaction was already committed or rolled back when timeout happened.
        // Should normally not happen as timeout is cancelled when transaction is committed or rolled back.
        // No further action needed though.
        debug('Transaction already committed or rolled back when timeout happened.', transactionId)
      }
    }, timeout)
  }

  private async closeTransaction(tx: TransactionWrapper, status: 'committed' | 'rolled_back' | 'timed_out') {
    debug('Closing transaction.', { transactionId: tx.id, status })

    tx.status = status

    if (tx.transaction && status === 'committed') {
      await tx.transaction.commit()

      if (!tx.transaction.options.usePhantomQuery) {
        await tx.transaction.executeRaw(COMMIT_QUERY())
      }
    } else if (tx.transaction) {
      await tx.transaction.rollback()
      if (!tx.transaction.options.usePhantomQuery) {
        await tx.transaction.executeRaw(ROLLBACK_QUERY())
      }
    }

    clearTimeout(tx.timer)
    tx.timer = undefined

    this.transactions.delete(tx.id)

    this.closedTransactions.push(tx)
    if (this.closedTransactions.length > MAX_CLOSED_TRANSACTIONS) {
      this.closedTransactions.shift()
    }
  }

  private validateOptions(options: Options) {
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
}
