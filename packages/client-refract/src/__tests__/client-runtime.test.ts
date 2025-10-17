/**
 * Tests for the lightweight Refract client runtime.
 * Verifies that model factories are invoked and transactions create scoped clients.
 */

import { describe, expect, it, vi } from 'vitest'

import { RefractClientBase, type ModelFactory } from '../client.js'

// Mock Kysely dialect to avoid requiring database connections
const mockKysely = {
  selectFrom: vi.fn().mockReturnThis(),
  selectAll: vi.fn().mockReturnThis(),
  execute: vi.fn().mockResolvedValue([]),
  destroy: vi.fn().mockResolvedValue(undefined),
  transaction: vi.fn().mockReturnValue({
    execute: vi.fn().mockImplementation((fn: any) => fn(mockKysely)),
  }),
}

const mockDialect = {
  createAdapter: vi.fn(),
  createDriver: vi.fn().mockReturnValue({
    init: vi.fn().mockResolvedValue(undefined),
    acquireConnection: vi.fn().mockResolvedValue({}),
    beginTransaction: vi.fn().mockResolvedValue({}),
    commitTransaction: vi.fn().mockResolvedValue(undefined),
    rollbackTransaction: vi.fn().mockResolvedValue(undefined),
    releaseConnection: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
  }),
  createIntrospector: vi.fn(),
  createQueryCompiler: vi.fn(),
}

// Mock Kysely constructor
vi.mock('kysely', async () => {
  const actual = await vi.importActual('kysely')
  return {
    ...actual,
    Kysely: vi.fn().mockImplementation(() => mockKysely),
  }
})

describe('RefractClientBase', () => {
  const modelFactory: ModelFactory<any> = vi.fn((kysely) => ({
    user: {
      findMany: vi.fn().mockImplementation(() => kysely.selectFrom('user')),
    },
  }))

  it('exposes the underlying Kysely instance', () => {
    const client = new RefractClientBase(mockDialect, { modelFactory })

    expect(client.$kysely).toBe(mockKysely)
    expect(modelFactory).toHaveBeenCalledWith(mockKysely)
  })

  it('attaches model operations from the factory', () => {
    const client = new RefractClientBase(mockDialect, { modelFactory })

    expect(client.user).toBeDefined()
    expect(typeof client.user.findMany).toBe('function')
    client.user.findMany()
    expect(mockKysely.selectFrom).toHaveBeenCalledWith('user')
  })

  it('supports transactions by cloning with a scoped Kysely instance', async () => {
    const client = new RefractClientBase(mockDialect, { modelFactory })
    modelFactory.mockClear()

    const result = await client.$transaction(async (scopedClient) => {
      expect(scopedClient).not.toBe(client)
      expect(scopedClient.$kysely).toBe(mockKysely)
      expect(scopedClient.user).toBeDefined()
      scopedClient.user.findMany()
      return 'ok'
    })

    expect(result).toBe('ok')
    expect(modelFactory).toHaveBeenCalledTimes(1)
    expect(mockKysely.selectFrom).toHaveBeenCalledWith('user')
  })

  it('allows manual model registration for advanced use-cases', () => {
    class CustomClient extends RefractClientBase {
      constructor() {
        super(mockDialect)
        this.registerModel('custom', {
          ping: () => 'pong',
        })
      }
    }

    const client = new CustomClient()
    expect(client.custom.ping()).toBe('pong')
  })
})
