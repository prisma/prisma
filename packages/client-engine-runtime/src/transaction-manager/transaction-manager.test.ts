import timers from 'node:timers/promises'

import type { SqlDriverAdapter, SqlQuery, SqlResultSet, Transaction } from '@prisma/driver-adapter-utils'
import { ok } from '@prisma/driver-adapter-utils'

import { noopTracingHelper } from '../tracing'
import { Options } from './transaction'
import { TransactionManager } from './transaction-manager'
import {
  InvalidTransactionIsolationLevelError,
  TransactionClosedError,
  TransactionExecutionTimeoutError,
  TransactionManagerError,
  TransactionNotFoundError,
  TransactionRolledBackError,
  TransactionStartTimeoutError,
} from './transaction-manager-error'

jest.useFakeTimers()

const START_TRANSACTION_TIME = 200
const TRANSACTION_EXECUTION_TIMEOUT = 500

const TRANSACTION_OPTIONS = {
  timeout: TRANSACTION_EXECUTION_TIMEOUT,
  maxWait: START_TRANSACTION_TIME * 2,
  isolationLevel: undefined,
} as Options

class MockDriverAdapter implements SqlDriverAdapter {
  adapterName = 'mock-adapter'
  provider: SqlDriverAdapter['provider']
  private readonly usePhantomQuery: boolean

  executeRawMock: jest.MockedFn<(params: SqlQuery) => Promise<number>> = jest.fn().mockResolvedValue(ok(1))
  commitMock: jest.MockedFn<() => Promise<void>> = jest.fn().mockResolvedValue(ok(undefined))
  rollbackMock: jest.MockedFn<() => Promise<void>> = jest.fn().mockResolvedValue(ok(undefined))

  constructor({ provider = 'postgres' as SqlDriverAdapter['provider'], usePhantomQuery = false } = {}) {
    this.usePhantomQuery = usePhantomQuery
    this.provider = provider
  }

  executeRaw(params: SqlQuery): Promise<number> {
    return this.executeRawMock(params)
  }

  queryRaw(_params: SqlQuery): Promise<SqlResultSet> {
    throw new Error('Not implemented for test')
  }

  executeScript(_script: string): Promise<void> {
    throw new Error('Method not implemented.')
  }

  dispose(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  startTransaction(): Promise<Transaction> {
    const executeRawMock = this.executeRawMock
    const commitMock = this.commitMock
    const rollbackMock = this.rollbackMock
    const usePhantomQuery = this.usePhantomQuery

    const mockTransaction: Transaction = {
      adapterName: 'mock-adapter',
      provider: 'postgres',
      options: { usePhantomQuery },
      queryRaw: jest.fn().mockRejectedValue('Not implemented for test'),
      executeRaw: executeRawMock,
      commit: commitMock,
      rollback: rollbackMock,
    }

    return new Promise((resolve) =>
      setTimeout(() => {
        resolve(mockTransaction)
      }, START_TRANSACTION_TIME),
    )
  }
}

async function startTransaction(transactionManager: TransactionManager, options: Partial<Options> = {}) {
  const [{ id }] = await Promise.all([
    transactionManager.startTransaction({
      timeout: TRANSACTION_EXECUTION_TIMEOUT,
      maxWait: START_TRANSACTION_TIME * 2,
      ...options,
    }),
    jest.advanceTimersByTimeAsync(START_TRANSACTION_TIME + 100),
  ])
  return id
}

test('transaction executes normally', async () => {
  const driverAdapter = new MockDriverAdapter()
  const transactionManager = new TransactionManager({
    driverAdapter,
    transactionOptions: TRANSACTION_OPTIONS,
    tracingHelper: noopTracingHelper,
  })

  const id = await startTransaction(transactionManager)

  await transactionManager.commitTransaction(id)

  expect(driverAdapter.commitMock).toHaveBeenCalled()
  expect(driverAdapter.executeRawMock.mock.calls[0][0].sql).toEqual('COMMIT')
  expect(driverAdapter.rollbackMock).not.toHaveBeenCalled()

  await expect(transactionManager.commitTransaction(id)).rejects.toBeInstanceOf(TransactionClosedError)
  await expect(transactionManager.rollbackTransaction(id)).rejects.toBeInstanceOf(TransactionClosedError)
})

test('transaction is rolled back', async () => {
  const driverAdapter = new MockDriverAdapter()
  const transactionManager = new TransactionManager({
    driverAdapter,
    transactionOptions: TRANSACTION_OPTIONS,
    tracingHelper: noopTracingHelper,
  })

  const id = await startTransaction(transactionManager)

  await transactionManager.rollbackTransaction(id)

  expect(driverAdapter.rollbackMock).toHaveBeenCalled()
  expect(driverAdapter.executeRawMock.mock.calls[0][0].sql).toEqual('ROLLBACK')
  expect(driverAdapter.commitMock).not.toHaveBeenCalled()

  await expect(transactionManager.commitTransaction(id)).rejects.toBeInstanceOf(TransactionRolledBackError)
  await expect(transactionManager.rollbackTransaction(id)).rejects.toBeInstanceOf(TransactionRolledBackError)
})

test('rollbackTransaction in parallel raises a TransactionRolledBackError', async () => {
  const driverAdapter = new MockDriverAdapter()
  const transactionManager = new TransactionManager({
    driverAdapter,
    transactionOptions: TRANSACTION_OPTIONS,
    tracingHelper: noopTracingHelper,
  })

  const id = await startTransaction(transactionManager)

  const rollbackPromise1 = transactionManager.rollbackTransaction(id)
  const rollbackPromise2 = transactionManager.rollbackTransaction(id)
  await rollbackPromise1

  await expect(rollbackPromise2).rejects.toEqual(new TransactionRolledBackError('rollback'))

  expect(driverAdapter.rollbackMock).toHaveBeenCalled()
  expect(driverAdapter.executeRawMock.mock.calls[0][0].sql).toEqual('ROLLBACK')
  expect(driverAdapter.commitMock).not.toHaveBeenCalled()
})

test('commitTransaction during a rollback caused by a time out raises a TransactionExecutionTimeoutError', async () => {
  const driverAdapter = new MockDriverAdapter()
  const timeout = 200
  const rollbackDelay = 200

  driverAdapter.rollbackMock = jest.fn().mockImplementation(() => timers.setTimeout(rollbackDelay))

  const transactionManager = new TransactionManager({
    driverAdapter,
    transactionOptions: { timeout, maxWait: 1000 },
    tracingHelper: noopTracingHelper,
  })

  const txPromise = transactionManager.startTransaction()
  await jest.advanceTimersByTimeAsync(START_TRANSACTION_TIME + timeout)
  const tx = await txPromise
  const commitPromise = transactionManager.commitTransaction(tx.id)

  await expect(Promise.all([jest.advanceTimersByTimeAsync(rollbackDelay), commitPromise])).rejects.toEqual(
    new TransactionExecutionTimeoutError('commit', {
      timeout,
      timeTaken: START_TRANSACTION_TIME + timeout + rollbackDelay,
    }),
  )

  expect(driverAdapter.rollbackMock).toHaveBeenCalled()
  expect(driverAdapter.executeRawMock.mock.calls[0][0].sql).toEqual('ROLLBACK')
  expect(driverAdapter.commitMock).not.toHaveBeenCalled()
})

test('transactions are rolled back when shutting down', async () => {
  const driverAdapter = new MockDriverAdapter()
  const transactionManager = new TransactionManager({
    driverAdapter,
    transactionOptions: TRANSACTION_OPTIONS,
    tracingHelper: noopTracingHelper,
  })

  const id1 = await startTransaction(transactionManager)
  const id2 = await startTransaction(transactionManager)

  await transactionManager.cancelAllTransactions()

  expect(driverAdapter.rollbackMock).toHaveBeenCalled()
  expect(driverAdapter.executeRawMock.mock.calls[0][0].sql).toEqual('ROLLBACK')
  expect(driverAdapter.executeRawMock.mock.calls[1][0].sql).toEqual('ROLLBACK')
  expect(driverAdapter.commitMock).not.toHaveBeenCalled()

  await expect(transactionManager.commitTransaction(id1)).rejects.toBeInstanceOf(TransactionRolledBackError)
  await expect(transactionManager.rollbackTransaction(id1)).rejects.toBeInstanceOf(TransactionRolledBackError)
  await expect(transactionManager.commitTransaction(id2)).rejects.toBeInstanceOf(TransactionRolledBackError)
  await expect(transactionManager.rollbackTransaction(id2)).rejects.toBeInstanceOf(TransactionRolledBackError)
})

test('when driver adapter requires phantom queries does not execute transaction statements', async () => {
  const driverAdapter = new MockDriverAdapter({ usePhantomQuery: true })
  const transactionManager = new TransactionManager({
    driverAdapter,
    transactionOptions: TRANSACTION_OPTIONS,
    tracingHelper: noopTracingHelper,
  })

  const id = await startTransaction(transactionManager)

  await transactionManager.commitTransaction(id)

  expect(driverAdapter.commitMock).toHaveBeenCalled()
  expect(driverAdapter.executeRawMock).not.toHaveBeenCalled()
  expect(driverAdapter.rollbackMock).not.toHaveBeenCalled()

  await expect(transactionManager.commitTransaction(id)).rejects.toBeInstanceOf(TransactionClosedError)
  await expect(transactionManager.rollbackTransaction(id)).rejects.toBeInstanceOf(TransactionClosedError)
})

test('with explicit isolation level', async () => {
  const driverAdapter = new MockDriverAdapter()
  const transactionManager = new TransactionManager({
    driverAdapter,
    transactionOptions: TRANSACTION_OPTIONS,
    tracingHelper: noopTracingHelper,
  })

  const id = await startTransaction(transactionManager, { isolationLevel: 'SERIALIZABLE' })

  await transactionManager.commitTransaction(id)

  expect(driverAdapter.commitMock).toHaveBeenCalled()
  expect(driverAdapter.executeRawMock.mock.calls[0][0].sql).toEqual('COMMIT')
  expect(driverAdapter.rollbackMock).not.toHaveBeenCalled()

  await expect(transactionManager.commitTransaction(id)).rejects.toBeInstanceOf(TransactionClosedError)
  await expect(transactionManager.rollbackTransaction(id)).rejects.toBeInstanceOf(TransactionClosedError)
})

test('with isolation level only supported in MS SQL Server, "snapshot"', async () => {
  const driverAdapter = new MockDriverAdapter()
  const transactionManager = new TransactionManager({
    driverAdapter,
    transactionOptions: TRANSACTION_OPTIONS,
    tracingHelper: noopTracingHelper,
  })

  await expect(startTransaction(transactionManager, { isolationLevel: 'SNAPSHOT' })).rejects.toBeInstanceOf(
    InvalidTransactionIsolationLevelError,
  )
})

test('transaction times out during starting', async () => {
  const driverAdapter = new MockDriverAdapter()
  const transactionManager = new TransactionManager({
    driverAdapter,
    transactionOptions: TRANSACTION_OPTIONS,
    tracingHelper: noopTracingHelper,
  })

  await expect(startTransaction(transactionManager, { maxWait: START_TRANSACTION_TIME / 2 })).rejects.toBeInstanceOf(
    TransactionStartTimeoutError,
  )

  // The transaction start is still in progress when we time out.
  // Once it completes, it will be rolled back to avoid connection leaks.
  // At this point, it hasn't completed yet, so rollback hasn't been called.
  expect(driverAdapter.rollbackMock).not.toHaveBeenCalled()

  // Now let the startTransaction promise resolve
  await jest.advanceTimersByTimeAsync(START_TRANSACTION_TIME)

  // The transaction that was started in the background should now be rolled back
  // to release the connection back to the pool.
  expect(driverAdapter.rollbackMock).toHaveBeenCalled()
})

test('transaction start timeout cleans up connection if transaction eventually starts', async () => {
  // This test verifies that when maxWait timeout fires but startTransaction
  // eventually completes, we properly rollback to avoid leaking connections.

  const SLOW_START_TRANSACTION_TIME = 500
  const MAX_WAIT = 100
  const TIME_PAST_MAX_WAIT = MAX_WAIT + 50
  const REMAINING_TIME_FOR_START = SLOW_START_TRANSACTION_TIME - TIME_PAST_MAX_WAIT

  const rollbackMock = jest.fn().mockResolvedValue(undefined)

  const driverAdapter = {
    adapterName: 'slow-adapter',
    provider: 'postgres' as const,
    executeRaw: jest.fn().mockResolvedValue(1),
    queryRaw: jest.fn(),
    executeScript: jest.fn(),
    dispose: jest.fn(),
    startTransaction: jest.fn().mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                adapterName: 'slow-adapter',
                provider: 'postgres',
                options: { usePhantomQuery: false },
                queryRaw: jest.fn(),
                executeRaw: jest.fn(),
                commit: jest.fn(),
                rollback: rollbackMock,
              }),
            SLOW_START_TRANSACTION_TIME,
          ),
        ),
    ),
  }

  const transactionManager = new TransactionManager({
    driverAdapter,
    transactionOptions: { timeout: TRANSACTION_EXECUTION_TIMEOUT, maxWait: MAX_WAIT },
    tracingHelper: noopTracingHelper,
  })

  // Start a transaction with a maxWait shorter than the actual connection time
  // Use Promise.all to advance timers and wait for the rejection simultaneously
  const [, txResult] = await Promise.all([
    jest.advanceTimersByTimeAsync(TIME_PAST_MAX_WAIT),
    transactionManager.startTransaction().catch((e) => e),
  ])

  // The transaction should have timed out
  expect(txResult).toBeInstanceOf(TransactionStartTimeoutError)

  // Rollback should not have been called yet because startTransaction hasn't completed
  expect(rollbackMock).not.toHaveBeenCalled()

  // Now advance time to let the startTransaction promise resolve
  await jest.advanceTimersByTimeAsync(REMAINING_TIME_FOR_START)

  // After the background startTransaction completes, rollback should be called
  // to release the connection and avoid pool exhaustion
  expect(rollbackMock).toHaveBeenCalled()
})

test('transaction times out during execution', async () => {
  const driverAdapter = new MockDriverAdapter()
  const transactionManager = new TransactionManager({
    driverAdapter,
    transactionOptions: TRANSACTION_OPTIONS,
    tracingHelper: noopTracingHelper,
  })

  const id = await startTransaction(transactionManager)

  await jest.advanceTimersByTimeAsync(TRANSACTION_EXECUTION_TIMEOUT + 100)

  await expect(transactionManager.commitTransaction(id)).rejects.toBeInstanceOf(TransactionExecutionTimeoutError)
  await expect(transactionManager.rollbackTransaction(id)).rejects.toBeInstanceOf(TransactionExecutionTimeoutError)
})

test('internal transaction does not apply the default start timeout', async () => {
  const driverAdapter = new MockDriverAdapter()
  const transactionManager = new TransactionManager({
    driverAdapter,
    transactionOptions: { ...TRANSACTION_OPTIONS, maxWait: START_TRANSACTION_TIME / 2 },
    tracingHelper: noopTracingHelper,
  })

  const [tx] = await Promise.all([
    transactionManager.startInternalTransaction(),
    jest.advanceTimersByTimeAsync(START_TRANSACTION_TIME),
  ])
  await transactionManager.commitTransaction(tx.id)

  expect(driverAdapter.commitMock).toHaveBeenCalled()
  expect(driverAdapter.rollbackMock).not.toHaveBeenCalled()
})

test('internal transaction does not apply the default execution timeout', async () => {
  const driverAdapter = new MockDriverAdapter()
  const transactionManager = new TransactionManager({
    driverAdapter,
    transactionOptions: { ...TRANSACTION_OPTIONS, timeout: TRANSACTION_EXECUTION_TIMEOUT / 2 },
    tracingHelper: noopTracingHelper,
  })

  const [tx] = await Promise.all([
    transactionManager.startInternalTransaction(),
    jest.advanceTimersByTimeAsync(START_TRANSACTION_TIME),
  ])
  await jest.advanceTimersByTimeAsync(TRANSACTION_EXECUTION_TIMEOUT)
  await transactionManager.commitTransaction(tx.id)

  expect(driverAdapter.commitMock).toHaveBeenCalled()
  expect(driverAdapter.rollbackMock).not.toHaveBeenCalled()
})

test('trying to commit or rollback invalid transaction id fails with TransactionNotFoundError', async () => {
  const driverAdapter = new MockDriverAdapter()
  const transactionManager = new TransactionManager({
    driverAdapter,
    transactionOptions: TRANSACTION_OPTIONS,
    tracingHelper: noopTracingHelper,
  })

  await expect(transactionManager.commitTransaction('invalid-tx-id')).rejects.toBeInstanceOf(TransactionNotFoundError)
  await expect(transactionManager.rollbackTransaction('invalid-tx-id')).rejects.toBeInstanceOf(TransactionNotFoundError)

  expect(driverAdapter.executeRawMock).not.toHaveBeenCalled()
  expect(driverAdapter.commitMock).not.toHaveBeenCalled()
  expect(driverAdapter.rollbackMock).not.toHaveBeenCalled()
})

test('TransactionManagerErrors have common structure', () => {
  const error = new TransactionManagerError('test message', { foo: 'bar' })

  expect(error.code).toEqual('P2028')
  expect(error.message).toEqual('Transaction API error: test message')
  expect(error.meta).toEqual({ foo: 'bar' })
})

test('startTransaction works when setTimeout returns a timer without unref (workerd environment)', async () => {
  const originalSetTimeout = global.setTimeout
  const setTimeoutSpy = jest
    .spyOn(global, 'setTimeout')
    .mockImplementation((callback: (...args: any[]) => void, ms?: number, ...args: any[]) => {
      const timer = originalSetTimeout(callback, ms, ...args)
      // @ts-expect-error
      timer.unref = undefined
      return timer
    })
  const driverAdapter = new MockDriverAdapter()
  const transactionManager = new TransactionManager({
    driverAdapter,
    transactionOptions: TRANSACTION_OPTIONS,
    tracingHelper: noopTracingHelper,
  })

  // This should not throw, even though the timer has no unref
  const id = await startTransaction(transactionManager)
  await transactionManager.commitTransaction(id)

  setTimeoutSpy.mockRestore()
})
