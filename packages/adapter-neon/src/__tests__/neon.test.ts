import * as neon from '@neondatabase/serverless'
import { getLogs } from '@prisma/debug'
import { describe, expect, it, vi } from 'vitest'

import { PrismaNeonAdapterFactory } from '../neon'

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
