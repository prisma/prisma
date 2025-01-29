import Debug from '@prisma/debug'
import { DriverAdapter, SQLQuery, Transaction } from '@prisma/driver-adapter-utils'
import { assertNever } from '@prisma/internals'
import crypto from 'crypto'

import type * as Tx from '../../common/types/Transaction'
import { IsolationLevel } from '../../common/types/Transaction'
import {
  InvalidTransactionIsolationLevelError,
  TransactionClosedError,
  TransactionDriverAdapterError,
  TransactionExecutionTimeoutError,
  TransactionInternalConsistencyError,
  TransactionManagerError,
  TransactionNotFoundError,
  TransactionRolledBackError,
  TransactionStartTimoutError,
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
  timer?: NodeJS.Timeout
  timeout: number
  startedAt: number
  transaction?: Transaction
}

const debug = Debug('prisma:client:transactionManager')

const COMMIT_QUERY = (): SQLQuery => ({ kind: 'sql', sql: 'COMMIT', args: [], argTypes: [] })
const ROLLBACK_QUERY = (): SQLQuery => ({ kind: 'sql', sql: 'ROLLBACK', args: [], argTypes: [] })
const ISOLATION_LEVEL_QUERY = (isolationLevel: IsolationLevel): SQLQuery => ({
  kind: 'sql',
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
  private readonly driverAdapter: DriverAdapter
  private readonly clientVersion: string

  constructor({ driverAdapter, clientVersion }: { driverAdapter: DriverAdapter; clientVersion: string }) {
    this.driverAdapter = driverAdapter
    this.clientVersion = clientVersion
  }

  async startTransaction(options: Tx.Options): Promise<Tx.InteractiveTransactionInfo<undefined>> {
    const validatedOptions = this.validateOptions(options)

    const transaction: TransactionWrapper = {
      id: crypto.randomUUID(),
      status: 'waiting',
      timer: undefined,
      timeout: validatedOptions.timeout,
      startedAt: Date.now(),
      transaction: undefined,
    }
    this.transactions.set(transaction.id, transaction)

    // Start timeout to wait for transaction to be started.
    transaction.timer = this.startTransactionTimeout(transaction.id, validatedOptions.maxWait)

    const txContext = await this.driverAdapter.transactionContext()
    if (!txContext.ok)
      throw new TransactionDriverAdapterError('Failed to start transaction.', {
        driverAdapterError: txContext.error,
        clientVersion: this.clientVersion,
      })

    if (this.requiresSettingIsolationLevelFirst() && validatedOptions.isolationLevel) {
      await txContext.value.executeRaw(ISOLATION_LEVEL_QUERY(validatedOptions.isolationLevel))
    }

    const startedTransaction = await txContext.value.startTransaction()
    if (!startedTransaction.ok)
      throw new TransactionDriverAdapterError('Failed to start transaction.', {
        driverAdapterError: startedTransaction.error,
        clientVersion: this.clientVersion,
      })

    if (!startedTransaction.value.options.usePhantomQuery) {
      await startedTransaction.value.executeRaw({ kind: 'sql', sql: 'BEGIN', args: [], argTypes: [] })

      if (!this.requiresSettingIsolationLevelFirst() && validatedOptions.isolationLevel) {
        await txContext.value.executeRaw(ISOLATION_LEVEL_QUERY(validatedOptions.isolationLevel))
      }
    }

    // Transaction status might have changed to timed_out while waiting for transaction to start. => Check for it!
    switch (transaction.status) {
      case 'waiting':
        transaction.transaction = startedTransaction.value
        clearTimeout(transaction.timer)
        transaction.timer = undefined
        transaction.status = 'running'

        // Start timeout to wait for transaction to be finished.
        transaction.timer = this.startTransactionTimeout(transaction.id, validatedOptions.timeout)

        return { id: transaction.id, payload: undefined }
      case 'timed_out':
        throw new TransactionStartTimoutError({ clientVersion: this.clientVersion })
      case 'running':
      case 'committed':
      case 'rolled_back':
        throw new TransactionInternalConsistencyError(
          `Transaction in invalid state ${transaction.status} although it just finished startup.`,
          {
            clientVersion: this.clientVersion,
          },
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

  getTransaction(txInfo: Tx.InteractiveTransactionInfo<unknown>, operation: string): Transaction {
    const tx = this.getActiveTransaction(txInfo.id, operation)
    if (!tx.transaction) throw new TransactionNotFoundError({ clientVersion: this.clientVersion })
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
            throw new TransactionInternalConsistencyError('Active transaction found in closed transactions list.', {
              clientVersion: this.clientVersion,
            })
          case 'committed':
            throw new TransactionClosedError(operation, { clientVersion: this.clientVersion })
          case 'rolled_back':
            throw new TransactionRolledBackError(operation, { clientVersion: this.clientVersion })
          case 'timed_out':
            throw new TransactionExecutionTimeoutError(operation, {
              timeout: closedTransaction.timeout,
              timeTaken: Date.now() - closedTransaction.startedAt,
              clientVersion: this.clientVersion,
            })
        }
      } else {
        debug(`Transaction not found.`, transactionId)
        throw new TransactionNotFoundError({ clientVersion: this.clientVersion })
      }
    }

    if (['committed', 'rolled_back', 'timed_out'].includes(transaction.status)) {
      throw new TransactionInternalConsistencyError('Closed transaction found in active transactions map.', {
        clientVersion: this.clientVersion,
      })
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
      if (!result.ok)
        throw new TransactionDriverAdapterError('Failed to commit transaction.', {
          driverAdapterError: result.error,
          clientVersion: this.clientVersion,
        })
      if (!tx.transaction.options.usePhantomQuery) {
        await tx.transaction.executeRaw(COMMIT_QUERY())
      }
    } else if (tx.transaction) {
      const result = await tx.transaction.rollback()
      if (!result.ok)
        throw new TransactionDriverAdapterError('Failed to rollback transaction.', {
          driverAdapterError: result.error,
          clientVersion: this.clientVersion,
        })
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

  private validateOptions(options: Tx.Options) {
    // Supplying timeout default values is cared for upstream already.
    if (!options.timeout)
      throw new TransactionManagerError('timeout is required', { clientVersion: this.clientVersion })
    if (!options.maxWait)
      throw new TransactionManagerError('maxWait is required', { clientVersion: this.clientVersion })

    // Snapshot level only supported for MS SQL Server, which is not supported via driver adapters so far.
    if (options.isolationLevel === IsolationLevel.Snapshot)
      throw new InvalidTransactionIsolationLevelError(options.isolationLevel, { clientVersion: this.clientVersion })

    // SQLite only has serializable isolation level.
    if (
      this.driverAdapter.provider === 'sqlite' &&
      options.isolationLevel &&
      options.isolationLevel !== IsolationLevel.Serializable
    )
      throw new InvalidTransactionIsolationLevelError(options.isolationLevel, { clientVersion: this.clientVersion })

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
