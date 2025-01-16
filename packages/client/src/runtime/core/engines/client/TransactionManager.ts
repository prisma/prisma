import Debug from '@prisma/debug'
import { DriverAdapter, Transaction } from '@prisma/driver-adapter-utils'
import { assertNever } from '@prisma/internals'
import crypto from 'crypto'

import type * as Tx from '../common/types/Transaction'
import {
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

type TransactionWrapper = {
  id: string
  status: 'waiting' | 'running' | 'committed' | 'rolled_back' | 'timed_out'
  timeout?: NodeJS.Timeout
  transaction?: Transaction
}

const debug = Debug('prisma:client:transactionManager')

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
    // Supplying timeout default values is cared for upstream already.
    if (!options.timeout) throw new TransactionManagerError('Timeout is required')
    if (!options.maxWait) throw new TransactionManagerError('maxWait is required')
    // TODO: care about transaction isolation levels?

    const transaction: TransactionWrapper = {
      id: crypto.randomUUID(),
      status: 'waiting',
      timeout: undefined,
      transaction: undefined,
    }
    this.transactions.set(transaction.id, transaction)

    // Start timeout to wait for transaction to be started.
    transaction.timeout = this.startTransactionTimeout(transaction.id, options.maxWait)

    const txContext = await this.driverAdapter.transactionContext()
    if (!txContext.ok) throw new TransactionDriverAdapterError('Failed to start transaction.', txContext.error)
    const startedTransaction = await txContext.value.startTransaction()
    if (!startedTransaction.ok)
      throw new TransactionDriverAdapterError('Failed to start transaction.', startedTransaction.error)

    // Transaction status might have changed to timed_out while waiting for transaction to start. => Check for it!
    switch (transaction.status) {
      case 'waiting':
        transaction.transaction = startedTransaction.value
        clearTimeout(transaction.timeout)
        transaction.timeout = undefined
        transaction.status = 'running'

        // Start timeout to wait for transaction to be finished.
        transaction.timeout = this.startTransactionTimeout(transaction.id, options.timeout)

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
    } else if (tx.transaction) {
      const result = await tx.transaction.rollback()
      if (!result.ok) throw new TransactionDriverAdapterError('Failed to rollback transaction.', result.error)
    }

    clearTimeout(tx.timeout)
    tx.timeout = undefined

    this.transactions.delete(tx.id)

    this.closedTransactions.push(tx)
    if (this.closedTransactions.length > MAX_CLOSED_TRANSACTIONS) {
      this.closedTransactions.shift()
    }
  }
}
