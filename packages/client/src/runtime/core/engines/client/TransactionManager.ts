import Debug from '@prisma/debug'
import { DriverAdapter, Query, Transaction } from '@prisma/driver-adapter-utils'
import { assertNever } from '@prisma/internals'
import crypto from 'crypto'

import type * as Tx from '../common/types/Transaction'
import { IsolationLevel } from '../common/types/Transaction'
import {
  InvalidTransactionIsolationLevelError,
  TransactionAlreadyCommittedError,
  TransactionClosedError,
  TransactionDriverAdapterError,
  TransactionInternalConsistencyError,
  TransactionManagerError,
  TransactionNotFoundError,
  TransactionRolledBackError,
  TransactionTimedOutError,
} from './TransactionManagerErrors'

const MAX_CLOSED_TRANSACTIONS = 100

const isolationLevelMap = {
  ReadUncommitted: 'READ UNCOMMITTED',
  ReadCommitted: 'READ COMMITTED',
  RepeatableRead: 'REPEATABLE READ',
  Snapshot: 'SNAPSHOT',
  Serializable: 'SERIALIZABLE',
}

type TransactionWrapper = {
  id: string
  status: 'waiting' | 'running' | 'committed' | 'rolled_back' | 'timed_out'
  timeout?: NodeJS.Timeout
  transaction?: Transaction
}

const debug = Debug('prisma:client:transactionManager')

const COMMIT_QUERY = (): Query => ({ sql: 'COMMIT', args: [], argTypes: [] })
const ROLLBACK_QUERY = (): Query => ({ sql: 'ROLLBACK', args: [], argTypes: [] })
const ISOLATION_LEVEL_QUERY = (isolationLevel: IsolationLevel): Query => ({
  sql: 'SET TRANSACTION ISOLATION LEVEL ' + isolationLevelMap[isolationLevel],
  args: [],
  argTypes: [],
})

export class TransactionManager {
  // The map of active transactions.
  private transactions: Map<string, TransactionWrapper> = new Map()
  // List of last closed transactions. Max MAX_CLOSED_TRANSACTIONS entries.
  // Used to provide better error messages than a generic "transaction not found".
  private closedTransactions: TransactionWrapper[] = []
  private driverAdapter: DriverAdapter

  constructor(driverAdapter: DriverAdapter) {
    this.driverAdapter = driverAdapter
  }

  async startTransaction(options: Tx.Options): Promise<Tx.InteractiveTransactionInfo<undefined>> {
    const validatedOptions = this.validateOptions(options)

    const transaction: TransactionWrapper = {
      id: crypto.randomUUID(),
      status: 'waiting',
      timeout: undefined,
      transaction: undefined,
    }
    this.transactions.set(transaction.id, transaction)

    // Start timeout to wait for transaction to be started.
    transaction.timeout = this.startTransactionTimeout(transaction.id, validatedOptions.maxWait)

    const txContext = await this.driverAdapter.transactionContext()
    if (!txContext.ok) throw new TransactionDriverAdapterError('Failed to start transaction.', txContext.error)

    if (this.requiresSettingIsolationLevelFirst() && validatedOptions.isolationLevel) {
      await txContext.value.executeRaw(ISOLATION_LEVEL_QUERY(validatedOptions.isolationLevel))
    }

    const startedTransaction = await txContext.value.startTransaction()
    if (!startedTransaction.ok)
      throw new TransactionDriverAdapterError('Failed to start transaction.', startedTransaction.error)

    if (!startedTransaction.value.options.usePhantomQuery) {
      await startedTransaction.value.executeRaw({ sql: 'BEGIN', args: [], argTypes: [] })

      if (!this.requiresSettingIsolationLevelFirst() && validatedOptions.isolationLevel) {
        await txContext.value.executeRaw(ISOLATION_LEVEL_QUERY(validatedOptions.isolationLevel))
      }
    }

    // Transaction status might have changed to timed_out while waiting for transaction to start. => Check for it!
    switch (transaction.status) {
      case 'waiting':
        transaction.transaction = startedTransaction.value
        clearTimeout(transaction.timeout)
        transaction.timeout = undefined
        transaction.status = 'running'

        // Start timeout to wait for transaction to be finished.
        transaction.timeout = this.startTransactionTimeout(transaction.id, validatedOptions.timeout)

        return { id: transaction.id, payload: undefined }
      case 'timed_out':
        throw new TransactionTimedOutError()
      case 'running':
        throw new TransactionInternalConsistencyError('Transaction already running.')
      case 'committed':
      case 'rolled_back':
        throw new TransactionClosedError(transaction.status)
      default:
        assertNever(transaction.status, 'Unknown transaction status.')
    }
  }

  async commitTransaction(transactionId: string): Promise<void> {
    const txw = this.getActiveTransaction(transactionId)
    await this.closeTransaction(txw, 'committed')
  }

  async rollbackTransaction(transactionId: string): Promise<void> {
    const txw = this.getActiveTransaction(transactionId)
    await this.closeTransaction(txw, 'rolled_back')
  }

  private getActiveTransaction(transactionId: string): TransactionWrapper {
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
            throw new TransactionAlreadyCommittedError()
          case 'rolled_back':
            throw new TransactionRolledBackError()
          case 'timed_out':
            throw new TransactionTimedOutError()
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
      const result = await tx.transaction.commit()
      if (!result.ok) throw new TransactionDriverAdapterError('Failed to commit transaction.', result.error)
      if (!tx.transaction.options.usePhantomQuery) {
        await tx.transaction.executeRaw(COMMIT_QUERY())
      }
    } else if (tx.transaction) {
      const result = await tx.transaction.rollback()
      if (!result.ok) throw new TransactionDriverAdapterError('Failed to rollback transaction.', result.error)
      if (!tx.transaction.options.usePhantomQuery) {
        await tx.transaction.executeRaw(ROLLBACK_QUERY())
      }
    }

    clearTimeout(tx.timeout)
    tx.timeout = undefined

    this.transactions.delete(tx.id)

    this.closedTransactions.push(tx)
    if (this.closedTransactions.length > MAX_CLOSED_TRANSACTIONS) {
      this.closedTransactions.shift()
    }
  }

  private validateOptions(options: Tx.Options) {
    // Supplying timeout default values is cared for upstream already.
    if (!options.timeout) throw new TransactionManagerError('timeout is required')
    if (!options.maxWait) throw new TransactionManagerError('maxWait is required')

    // Snapshot level only supported for MS SQL Server, which is not supported via driver adapters so far.
    if (options.isolationLevel === IsolationLevel.Snapshot)
      throw new InvalidTransactionIsolationLevelError(options.isolationLevel)

    // SQLite only has serializable isolation level.
    if (
      this.driverAdapter.provider === 'sqlite' &&
      options.isolationLevel &&
      options.isolationLevel !== IsolationLevel.Serializable
    )
      throw new InvalidTransactionIsolationLevelError(options.isolationLevel)

    return {
      ...options,
      timeout: options.timeout,
      maxWait: options.maxWait,
    }
  }

  private requiresSettingIsolationLevelFirst() {
    return this.driverAdapter.provider === 'mysql'
  }
}
