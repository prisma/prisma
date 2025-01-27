import type {
  DriverAdapter,
  Flavour,
  Query,
  Result,
  ResultSet,
  Transaction,
  TransactionContext,
} from '@prisma/driver-adapter-utils'
import { ok } from '@prisma/driver-adapter-utils'

import { PrismaClientKnownRequestError } from '../../../errors/PrismaClientKnownRequestError'
import type * as Tx from '../../common/types/Transaction'
import { IsolationLevel } from '../../common/types/Transaction'
import { TransactionManager } from './TransactionManager'
import {
  InvalidTransactionIsolationLevelError,
  TransactionClosedError,
  TransactionExecutionTimeoutError,
  TransactionManagerError,
  TransactionNotFoundError,
  TransactionRolledBackError,
  TransactionStartTimoutError,
} from './TransactionManagerErrors'

jest.useFakeTimers()

const START_TRANSACTION_TIME = 200
const TRANSACTION_EXECUTION_TIMEOUT = 500

class MockDriverAdapter implements DriverAdapter {
  adapterName = 'mock-adapter'
  provider: Flavour
  private readonly usePhantomQuery: boolean

  executeRawMock: jest.MockedFn<(params: Query) => Promise<Result<number>>> = jest.fn().mockResolvedValue(ok(1))
  commitMock: jest.MockedFn<() => Promise<Result<void>>> = jest.fn().mockResolvedValue(ok(undefined))
  rollbackMock: jest.MockedFn<() => Promise<Result<void>>> = jest.fn().mockResolvedValue(ok(undefined))

  constructor({ provider = 'postgres' as Flavour, usePhantomQuery = false } = {}) {
    this.usePhantomQuery = usePhantomQuery
    this.provider = provider
  }

  executeRaw(params: Query): Promise<Result<number>> {
    return this.executeRawMock(params)
  }

  queryRaw(_params: Query): Promise<Result<ResultSet>> {
    throw new Error('Not implemented for test')
  }

  transactionContext(): Promise<Result<TransactionContext>> {
    const executeRawMock = this.executeRawMock
    const commitMock = this.commitMock
    const rollbackMock = this.rollbackMock
    const usePhantomQuery = this.usePhantomQuery

    const mockTransactionContext: TransactionContext = {
      adapterName: this.adapterName,
      provider: this.provider,
      queryRaw: jest.fn().mockRejectedValue('Not implemented for test'),
      executeRaw: executeRawMock,
      startTransaction(): Promise<Result<Transaction>> {
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
            resolve(ok(mockTransaction))
          }, START_TRANSACTION_TIME),
        )
      },
    }
    return Promise.resolve(ok(mockTransactionContext))
  }
}

async function startTransaction(transactionManager: TransactionManager, options: Partial<Tx.Options> = {}) {
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
  const transactionManager = new TransactionManager({ driverAdapter, clientVersion: '1.0.0' })

  const id = await startTransaction(transactionManager)

  if (driverAdapter.executeRawMock.mock.calls[0][0].kind !== 'sql') throw new Error('Expected SQL query!')
  expect(driverAdapter.executeRawMock.mock.calls[0][0].sql).toEqual('BEGIN')

  await transactionManager.commitTransaction(id)

  expect(driverAdapter.commitMock).toHaveBeenCalled()
  if (driverAdapter.executeRawMock.mock.calls[1][0].kind !== 'sql') throw new Error('Expected SQL query!')
  expect(driverAdapter.executeRawMock.mock.calls[1][0].sql).toEqual('COMMIT')
  expect(driverAdapter.rollbackMock).not.toHaveBeenCalled()

  await expect(transactionManager.commitTransaction(id)).rejects.toBeInstanceOf(TransactionClosedError)
  await expect(transactionManager.rollbackTransaction(id)).rejects.toBeInstanceOf(TransactionClosedError)
})

test('transaction is rolled back', async () => {
  const driverAdapter = new MockDriverAdapter()
  const transactionManager = new TransactionManager({ driverAdapter, clientVersion: '1.0.0' })

  const id = await startTransaction(transactionManager)

  if (driverAdapter.executeRawMock.mock.calls[0][0].kind !== 'sql') throw new Error('Expected SQL query!')
  expect(driverAdapter.executeRawMock.mock.calls[0][0].sql).toEqual('BEGIN')

  await transactionManager.rollbackTransaction(id)

  expect(driverAdapter.rollbackMock).toHaveBeenCalled()
  if (driverAdapter.executeRawMock.mock.calls[1][0].kind !== 'sql') throw new Error('Expected SQL query!')
  expect(driverAdapter.executeRawMock.mock.calls[1][0].sql).toEqual('ROLLBACK')
  expect(driverAdapter.commitMock).not.toHaveBeenCalled()

  await expect(transactionManager.commitTransaction(id)).rejects.toBeInstanceOf(TransactionRolledBackError)
  await expect(transactionManager.rollbackTransaction(id)).rejects.toBeInstanceOf(TransactionRolledBackError)
})

test('when driver adapter requires phantom queries does not execute transaction statements', async () => {
  const driverAdapter = new MockDriverAdapter({ usePhantomQuery: true })
  const transactionManager = new TransactionManager({ driverAdapter, clientVersion: '1.0.0' })

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
  const transactionManager = new TransactionManager({ driverAdapter, clientVersion: '1.0.0' })

  const id = await startTransaction(transactionManager, { isolationLevel: IsolationLevel.Serializable })

  if (driverAdapter.executeRawMock.mock.calls[0][0].kind !== 'sql') throw new Error('Expected SQL query!')
  expect(driverAdapter.executeRawMock.mock.calls[0][0].sql).toEqual('BEGIN')
  if (driverAdapter.executeRawMock.mock.calls[1][0].kind !== 'sql') throw new Error('Expected SQL query!')
  expect(driverAdapter.executeRawMock.mock.calls[1][0].sql).toEqual('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE')

  await transactionManager.commitTransaction(id)

  expect(driverAdapter.commitMock).toHaveBeenCalled()
  if (driverAdapter.executeRawMock.mock.calls[2][0].kind !== 'sql') throw new Error('Expected SQL query!')
  expect(driverAdapter.executeRawMock.mock.calls[2][0].sql).toEqual('COMMIT')
  expect(driverAdapter.rollbackMock).not.toHaveBeenCalled()

  await expect(transactionManager.commitTransaction(id)).rejects.toBeInstanceOf(TransactionClosedError)
  await expect(transactionManager.rollbackTransaction(id)).rejects.toBeInstanceOf(TransactionClosedError)
})

test('for MySQL with explicit isolation level requires isolation level set before BEGIN', async () => {
  const driverAdapter = new MockDriverAdapter({ provider: 'mysql' })
  const transactionManager = new TransactionManager({ driverAdapter, clientVersion: '1.0.0' })

  const id = await startTransaction(transactionManager, { isolationLevel: IsolationLevel.Serializable })

  if (driverAdapter.executeRawMock.mock.calls[0][0].kind !== 'sql') throw new Error('Expected SQL query!')
  expect(driverAdapter.executeRawMock.mock.calls[0][0].sql).toEqual('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE')
  if (driverAdapter.executeRawMock.mock.calls[1][0].kind !== 'sql') throw new Error('Expected SQL query!')
  expect(driverAdapter.executeRawMock.mock.calls[1][0].sql).toEqual('BEGIN')

  await transactionManager.commitTransaction(id)
})

test('for SQLite with unsupported isolation level', async () => {
  const driverAdapter = new MockDriverAdapter({ provider: 'sqlite' })
  const transactionManager = new TransactionManager({ driverAdapter, clientVersion: '1.0.0' })

  await expect(
    startTransaction(transactionManager, { isolationLevel: IsolationLevel.RepeatableRead }),
  ).rejects.toBeInstanceOf(InvalidTransactionIsolationLevelError)
})

test('with isolation level only supported in MS SQL Server, "snapshot"', async () => {
  const driverAdapter = new MockDriverAdapter()
  const transactionManager = new TransactionManager({ driverAdapter, clientVersion: '1.0.0' })

  await expect(
    startTransaction(transactionManager, { isolationLevel: IsolationLevel.Snapshot }),
  ).rejects.toBeInstanceOf(InvalidTransactionIsolationLevelError)
})

test('transaction times out during starting', async () => {
  const driverAdapter = new MockDriverAdapter()
  const transactionManager = new TransactionManager({ driverAdapter, clientVersion: '1.0.0' })

  await expect(startTransaction(transactionManager, { maxWait: START_TRANSACTION_TIME / 2 })).rejects.toBeInstanceOf(
    TransactionStartTimoutError,
  )
})

test('transaction times out during execution', async () => {
  const driverAdapter = new MockDriverAdapter()
  const transactionManager = new TransactionManager({ driverAdapter, clientVersion: '1.0.0' })

  const id = await startTransaction(transactionManager)

  await jest.advanceTimersByTimeAsync(TRANSACTION_EXECUTION_TIMEOUT + 100)

  await expect(transactionManager.commitTransaction(id)).rejects.toBeInstanceOf(TransactionExecutionTimeoutError)
  await expect(transactionManager.rollbackTransaction(id)).rejects.toBeInstanceOf(TransactionExecutionTimeoutError)
})

test('trying to commit or rollback invalid transaction id fails with TransactionNotFoundError', async () => {
  const driverAdapter = new MockDriverAdapter()
  const transactionManager = new TransactionManager({ driverAdapter, clientVersion: '1.0.0' })

  await expect(transactionManager.commitTransaction('invalid-tx-id')).rejects.toBeInstanceOf(TransactionNotFoundError)
  await expect(transactionManager.rollbackTransaction('invalid-tx-id')).rejects.toBeInstanceOf(TransactionNotFoundError)

  expect(driverAdapter.executeRawMock).not.toHaveBeenCalled()
  expect(driverAdapter.commitMock).not.toHaveBeenCalled()
  expect(driverAdapter.rollbackMock).not.toHaveBeenCalled()
})

test('TransactionManagerErrors are PrismaClientKnownRequestError', () => {
  const error = new TransactionManagerError('test message', { clientVersion: '1.0.0', meta: { foo: 'bar' } })

  expect(error).toBeInstanceOf(PrismaClientKnownRequestError)
  expect(error.code).toEqual('P2028')
  expect(error.message).toEqual('Transaction API error: test message')
  expect(error.clientVersion).toEqual('1.0.0')
  expect(error.meta).toEqual({ foo: 'bar' })
})
