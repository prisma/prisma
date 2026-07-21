import * as neon from '@neondatabase/serverless'
import { getLogs } from '@prisma/debug'
import type { SqlQuery } from '@prisma/driver-adapter-utils'
import { describe, expect, it, vi } from 'vitest'

import { PrismaNeonAdapterFactory, PrismaNeonHttpAdapter } from '../neon'

describe('PrismaNeonAdapterFactory', () => {
  it('should subscribe to pool error events', async () => {
    const config: neon.PoolConfig = { user: 'test', password: 'test', database: 'test', port: 5432, host: 'localhost' }
    const factory = new PrismaNeonAdapterFactory(config)
    const adapter = await factory.connect()

    const shutdownError = new neon.DatabaseError('terminating connection due to administrator command', 116, 'error')
    shutdownError.severity = 'FATAL'
    shutdownError.code = '57P01'
    shutdownError.routine = 'ProcessInterrupts'
    shutdownError.line = '3197'
    shutdownError.file = 'postgres.c'

    adapter['client'].emit('error', shutdownError)
    await adapter.dispose()
    const debug = getLogs()
    expect(debug).toContain('terminating connection due to administrator command')
  })

  it('should call onPoolError when supplied', async () => {
    const config: neon.PoolConfig = { user: 'test', password: 'test', database: 'test', port: 5432, host: 'localhost' }
    const onPoolError = vi.fn()
    const factory = new PrismaNeonAdapterFactory(config, { onPoolError })
    const adapter = await factory.connect()
    const error = new Error('Pool error')
    adapter['client'].emit('error', error)
    expect(onPoolError).toHaveBeenCalledWith(error)
    await adapter.dispose()
  })

  it('should remove connection error listener after transaction commit', async () => {
    const config: neon.PoolConfig = { user: 'test', password: 'test', database: 'test', port: 5432, host: 'localhost' }
    const factory = new PrismaNeonAdapterFactory(config)
    const adapter = await factory.connect()

    const mockConnection = {
      on: vi.fn(),
      removeListener: vi.fn(),
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    }

    adapter['client'].connect = vi.fn().mockResolvedValue(mockConnection)

    const transaction = await adapter.startTransaction()
    await transaction.commit()
    expect(mockConnection.removeListener).toHaveBeenCalledWith('error', expect.any(Function))

    await adapter.dispose()
  })

  it('should remove connection error listener after transaction rollback', async () => {
    const config: neon.PoolConfig = { user: 'test', password: 'test', database: 'test', port: 5432, host: 'localhost' }
    const factory = new PrismaNeonAdapterFactory(config)
    const adapter = await factory.connect()

    const mockConnection = {
      on: vi.fn(),
      removeListener: vi.fn(),
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
    }

    adapter['client'].connect = vi.fn().mockResolvedValue(mockConnection)

    const transaction = await adapter.startTransaction()
    await transaction.rollback()
    expect(mockConnection.removeListener).toHaveBeenCalledWith('error', expect.any(Function))

    await adapter.dispose()
  })
})

describe('PrismaNeonHttpAdapter', () => {
  it('maps args through mapArg before passing them to the HTTP client', async () => {
    const mockClient = vi.fn().mockResolvedValue({ fields: [], rows: [], rowCount: 0 })
    const adapter = new PrismaNeonHttpAdapter(mockClient as unknown as neon.NeonQueryFunction<any, any>)

    // a base64-encoded `Bytes` arg, as the query engine hands it to the adapter
    const bytesBase64 = Buffer.from('hello-raw-bytes').toString('base64')

    const query: SqlQuery = {
      sql: 'INSERT INTO "Thing" ("blob") VALUES ($1)',
      args: [bytesBase64],
      argTypes: [{ scalarType: 'bytes', arity: 'scalar' }],
    }

    await adapter.performIO(query)

    const [, values] = mockClient.mock.calls[0]
    expect(values[0]).toBeInstanceOf(Buffer)
    expect((values[0] as Buffer).toString('utf-8')).toBe('hello-raw-bytes')
    // the unmapped base64 string must not be what's sent to the driver
    expect(values[0]).not.toBe(bytesBase64)
  })
})
