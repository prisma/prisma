import pg from 'pg'
import { describe, expect, it, vi } from 'vitest'

import { PrismaPgAdapterFactory } from '../pg'

/**
 * A minimal drop-in-compatible `pg.Pool` that is deliberately NOT an instance
 * of the bundled `pg.Pool` class — mirroring what a pg-compatible fork such as
 * `@yugabytedb/pg` provides. It exposes the same structural surface the adapter
 * relies on (`query`, `connect`, `end`, EventEmitter members and `options`),
 * so it should be usable with `PrismaPgAdapter`/`PrismaPgAdapterFactory`.
 */
class CompatiblePool {
  readonly options: pg.PoolConfig = {
    user: 'test',
    password: 'test',
    database: 'test',
    host: 'localhost',
    port: 5432,
  }

  readonly query = vi.fn(async () => ({ rows: [], fields: [], rowCount: 0 }))
  readonly connect = vi.fn(async () => ({}))
  readonly end = vi.fn(async () => undefined)
  readonly on = vi.fn(() => this)
  readonly removeListener = vi.fn(() => this)
  readonly emit = vi.fn(() => true)
  readonly listenerCount = vi.fn(() => 0)
}

describe('PrismaPgAdapterFactory with a pg-compatible pool', () => {
  it('accepts a pool that structurally matches pg.Pool but is not an instance of it', async () => {
    const pool = new CompatiblePool()
    const factory = new PrismaPgAdapterFactory(pool as unknown as pg.Pool)
    const adapter = await factory.connect()

    // The externally provided fork pool must be used as-is, instead of being
    // mistaken for a `PoolConfig` and a fresh internal `pg.Pool` being created.
    expect(adapter.underlyingDriver()).toBe(pool)
    expect(pool.on).toHaveBeenCalledWith('error', expect.any(Function))

    await adapter.dispose()
  })
})
