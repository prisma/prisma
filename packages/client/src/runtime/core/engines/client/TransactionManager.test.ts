import type { DriverAdapter, Queryable, Result, Transaction, TransactionContext } from '@prisma/driver-adapter-utils'
import { ok } from '@prisma/driver-adapter-utils'

import { TransactionManager } from './TransactionManager'
import {
  TransactionAlreadyCommittedError,
  TransactionNotFoundError,
  TransactionRolledBackError,
  TransactionTimedOutError,
} from './TransactionManagerErrors'

jest.useFakeTimers()

const START_TRANSACTION_TIME = 200

let transactionManager: TransactionManager

beforeEach(() => {
  const mockQueryAble: Queryable = {
    adapterName: 'mock-adapter',
    provider: 'postgres',
    executeRaw: jest.fn().mockRejectedValue('Not implemented for test'),
    queryRaw: jest.fn().mockRejectedValue('Not implemented for test'),
  }

  const mockTransaction: Transaction = {
    ...mockQueryAble,
    options: { usePhantomQuery: false },
    commit: jest.fn().mockResolvedValue(ok(undefined)),
    rollback: jest.fn().mockResolvedValue(ok(undefined)),
  }

  const transactionContext: TransactionContext = {
    ...mockQueryAble,
    startTransaction(): Promise<Result<Transaction>> {
      return new Promise((resolve) =>
        setTimeout(() => {
          resolve(ok(mockTransaction))
        }, START_TRANSACTION_TIME),
      )
    },
  }

  const driverAdapter: DriverAdapter = {
    provider: 'postgres',
    adapterName: '@prisma/adapter-mock',
    queryRaw: jest.fn().mockRejectedValue('Not implemented for test'),
    executeRaw: jest.fn().mockRejectedValue('Not implemented for test'),
    transactionContext: () => {
      return Promise.resolve(ok(transactionContext))
    },
  }

  transactionManager = new TransactionManager(driverAdapter)
})

test('transaction executes normally', async () => {
  const start = transactionManager.startTransaction({ timeout: 500, maxWait: START_TRANSACTION_TIME * 2 })

  await jest.advanceTimersByTimeAsync(START_TRANSACTION_TIME + 100)
  const { id } = await start

  await transactionManager.commitTransaction(id)

  await expect(transactionManager.commitTransaction(id)).rejects.toBeInstanceOf(TransactionAlreadyCommittedError)
  await expect(transactionManager.rollbackTransaction(id)).rejects.toBeInstanceOf(TransactionAlreadyCommittedError)
})

test('transaction is rolled back', async () => {
  const start = transactionManager.startTransaction({ timeout: 500, maxWait: START_TRANSACTION_TIME * 2 })

  await jest.advanceTimersByTimeAsync(START_TRANSACTION_TIME + 100)
  const { id } = await start

  await transactionManager.rollbackTransaction(id)

  await expect(transactionManager.commitTransaction(id)).rejects.toBeInstanceOf(TransactionRolledBackError)
  await expect(transactionManager.rollbackTransaction(id)).rejects.toBeInstanceOf(TransactionRolledBackError)
})

test('transaction times out during starting', async () => {
  const start = transactionManager.startTransaction({ timeout: 500, maxWait: START_TRANSACTION_TIME / 2 })

  await Promise.all([
    jest.advanceTimersByTimeAsync(START_TRANSACTION_TIME + 100),
    expect(start).rejects.toBeInstanceOf(TransactionTimedOutError),
  ])
})

test('transaction times out during execution', async () => {
  const start = transactionManager.startTransaction({ timeout: 500, maxWait: START_TRANSACTION_TIME * 2 })

  await jest.advanceTimersByTimeAsync(START_TRANSACTION_TIME + 100)
  const { id } = await start

  await jest.advanceTimersByTimeAsync(600)

  await expect(transactionManager.commitTransaction(id)).rejects.toBeInstanceOf(TransactionTimedOutError)
  await expect(transactionManager.rollbackTransaction(id)).rejects.toBeInstanceOf(TransactionTimedOutError)
})

test('trying to commit or rollback invalid transaction id fails with TransactionNotFoundError', async () => {
  const start = transactionManager.startTransaction({ timeout: 500, maxWait: START_TRANSACTION_TIME * 2 })

  await jest.advanceTimersByTimeAsync(START_TRANSACTION_TIME + 100)
  await start

  await expect(transactionManager.commitTransaction('invalid-tx-id')).rejects.toBeInstanceOf(TransactionNotFoundError)
  await expect(transactionManager.rollbackTransaction('invalid-tx-id')).rejects.toBeInstanceOf(TransactionNotFoundError)
})
