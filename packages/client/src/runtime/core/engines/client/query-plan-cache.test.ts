import { QueryPlanCache } from './query-plan-cache'

describe('QueryPlanCache', () => {
  describe('single cache', () => {
    it('stores and retrieves entries', () => {
      const cache = new QueryPlanCache()
      const plan = { type: 'value' as const, args: null }

      cache.setSingle('key1', plan)
      const retrieved = cache.getSingle('key1')

      expect(retrieved).toBe(plan)
    })

    it('returns undefined for missing keys', () => {
      const cache = new QueryPlanCache()

      expect(cache.getSingle('nonexistent')).toBeUndefined()
    })

    it('updates existing entries', () => {
      const cache = new QueryPlanCache()
      const plan1 = { type: 'value' as const, args: null }
      const plan2 = { type: 'value' as const, args: { test: true } }

      cache.setSingle('key', plan1)
      cache.setSingle('key', plan2)

      expect(cache.getSingle('key')).toBe(plan2)
      expect(cache.singleCacheSize).toBe(1)
    })

    it('evicts oldest entry when at capacity', () => {
      const cache = new QueryPlanCache(2)
      const plan1 = { type: 'value' as const, args: 1 }
      const plan2 = { type: 'value' as const, args: 2 }
      const plan3 = { type: 'value' as const, args: 3 }

      cache.setSingle('key1', plan1)
      cache.setSingle('key2', plan2)
      cache.setSingle('key3', plan3)

      expect(cache.getSingle('key1')).toBeUndefined()
      expect(cache.getSingle('key2')).toBeDefined()
      expect(cache.getSingle('key3')).toBeDefined()
      expect(cache.singleCacheSize).toBe(2)
    })

    it('refreshes entry on get (LRU behavior)', () => {
      const cache = new QueryPlanCache(2)
      const plan1 = { type: 'value' as const, args: 1 }
      const plan2 = { type: 'value' as const, args: 2 }
      const plan3 = { type: 'value' as const, args: 3 }

      cache.setSingle('key1', plan1)
      cache.setSingle('key2', plan2)

      // Access key1 to make it recently used
      cache.getSingle('key1')

      // Add key3, should evict key2 (oldest)
      cache.setSingle('key3', plan3)

      expect(cache.getSingle('key1')).toBeDefined()
      expect(cache.getSingle('key2')).toBeUndefined()
      expect(cache.getSingle('key3')).toBeDefined()
    })
  })

  describe('batch cache', () => {
    it('stores and retrieves batch entries', () => {
      const cache = new QueryPlanCache()
      const response = {
        type: 'multi' as const,
        plans: [
          { type: 'value' as const, args: null },
          { type: 'value' as const, args: null },
        ],
      }

      cache.setBatch('batchKey', response)
      const retrieved = cache.getBatch('batchKey')

      expect(retrieved).toBe(response)
    })

    it('returns undefined for missing batch keys', () => {
      const cache = new QueryPlanCache()

      expect(cache.getBatch('nonexistent')).toBeUndefined()
    })

    it('stores compacted batch responses', () => {
      const cache = new QueryPlanCache()
      const response = {
        type: 'compacted' as const,
        plan: { type: 'value' as const, args: null },
        arguments: [{ id: 1 }, { id: 2 }],
        nestedSelection: ['name', 'email'],
        keys: ['id'],
        expectNonEmpty: true,
      }

      cache.setBatch('compactedKey', response)
      const retrieved = cache.getBatch('compactedKey')

      expect(retrieved).toBe(response)
      expect(retrieved?.type).toBe('compacted')
    })

    it('updates existing batch entries', () => {
      const cache = new QueryPlanCache()
      const response1 = { type: 'multi' as const, plans: [] }
      const response2 = { type: 'multi' as const, plans: [{ type: 'value' as const, args: null }] }

      cache.setBatch('key', response1)
      cache.setBatch('key', response2)

      expect(cache.getBatch('key')).toBe(response2)
      expect(cache.batchCacheSize).toBe(1)
    })

    it('evicts oldest batch entry when at capacity (tracking total queries)', () => {
      const cache = new QueryPlanCache(4) // Max 4 queries total

      const makeResponse = (id: number, count: number) => ({
        type: 'multi' as const,
        plans: Array(count).fill({ type: 'value' as const, args: id }),
      })

      cache.setBatch('key1', makeResponse(1, 2)) // Total: 2
      cache.setBatch('key2', makeResponse(2, 1)) // Total: 3
      cache.setBatch('key3', makeResponse(3, 2)) // Total: 5 (exceeds 4, evicts key1 -> Total: 3)

      expect(cache.getBatch('key1')).toBeUndefined()
      expect(cache.getBatch('key2')).toBeDefined()
      expect(cache.getBatch('key3')).toBeDefined()
      expect(cache.batchCacheSize).toBe(2)
    })

    it('triggers eviction when replacing an existing batch exceeds max total queries', () => {
      // Regression test: replacing an existing batch entry runs the eviction loop.
      //
      // Old code bug: early return after delete+set skips the while loop, allowing
      // total queries to far exceed maxSize.
      //
      // Scenario with maxSize=4:
      //   setBatch(key1, 2 plans) → {key1:2} total=2
      //   setBatch(key2, 1 plan)  → {key1:2, key2:1} total=3  (still ≤ max)
      //   replace key2 with 4 plans
      //     queryCount=4 > maxSize=4? No (4 is allowed)
      //     delete old key2 (1 plan), set new key2 (4 plans) → total = 3 + (4-1) = 6
      //     Old code: returns here, 2 entries with 6 total plans (BUG!)
      //     New code: while(6>4) evicts key1 (LRU), total=4, exits → {key2:4} ✓
      //
      const cache = new QueryPlanCache(4)

      cache.setBatch('key1', {
        type: 'multi' as const,
        plans: [
          { type: 'value' as const, args: 1 },
          { type: 'value' as const, args: 2 },
        ],
      }) // Total: 2
      cache.setBatch('key2', {
        type: 'multi' as const,
        plans: [{ type: 'value' as const, args: 3 }],
      }) // Total: 3

      // key1 is LRU (added first), key2 is MRU. Cache has {key1:2, key2:1} total=3.
      expect(cache.getBatch('key2')).toBeDefined() // key2 still in cache
      expect(cache.getBatch('key1')).toBeDefined() // key1 still in cache

      // Replace LRU key2 with 4 plans. total=6, while loop evicts key1 (LRU).
      cache.setBatch('key2', {
        type: 'multi' as const,
        plans: [
          { type: 'value' as const, args: 4 },
          { type: 'value' as const, args: 5 },
          { type: 'value' as const, args: 6 },
          { type: 'value' as const, args: 7 },
        ],
      }) // total=6, evicts key1 → total=4 (4≤4, stop)

      // Old code: both key1 and key2 remain in cache (BUG!), with 6 total plans
      // New code: key1 evicted (LRU was first inserted), only key2 remains
      expect(cache.getBatch('key1')).toBeUndefined() // evicted (LRU)
      expect(cache.getBatch('key2')).toBeDefined() // still in cache
      expect(cache.batchCacheSize).toBe(1)
    })

    it('does not cache a batch if its queries exceed maxSize', () => {
      const cache = new QueryPlanCache(2)

      const response = {
        type: 'multi' as const,
        plans: [
          { type: 'value' as const, args: null },
          { type: 'value' as const, args: null },
          { type: 'value' as const, args: null },
        ],
      }
      cache.setBatch('massiveKey', response)

      expect(cache.getBatch('massiveKey')).toBeUndefined()
      expect(cache.batchCacheSize).toBe(0)
    })

    it('refreshes batch entry on get (LRU behavior)', () => {
      const cache = new QueryPlanCache(2)
      const makeResponse = (id: number) => ({
        type: 'multi' as const,
        plans: [{ type: 'value' as const, args: id }],
      })

      cache.setBatch('key1', makeResponse(1))
      cache.setBatch('key2', makeResponse(2))

      // Access key1 to make it recently used
      cache.getBatch('key1')

      // Add key3, should evict key2 (oldest)
      cache.setBatch('key3', makeResponse(3))

      expect(cache.getBatch('key1')).toBeDefined()
      expect(cache.getBatch('key2')).toBeUndefined()
      expect(cache.getBatch('key3')).toBeDefined()
    })
  })

  describe('combined behavior', () => {
    it('maintains separate caches for single and batch entries', () => {
      const cache = new QueryPlanCache()

      const plan = { type: 'value' as const, args: 'single' }
      const response = { type: 'multi' as const, plans: [{ type: 'value' as const, args: 'batch' }] }

      cache.setSingle('sharedKey', plan)
      cache.setBatch('sharedKey', response)

      expect(cache.getSingle('sharedKey')).toBe(plan)
      expect(cache.getBatch('sharedKey')).toBe(response)
    })

    it('reports combined size', () => {
      const cache = new QueryPlanCache()

      cache.setSingle('single1', { type: 'value' as const, args: null })
      cache.setSingle('single2', { type: 'value' as const, args: null })
      cache.setBatch('batch1', { type: 'multi' as const, plans: [] })

      expect(cache.singleCacheSize).toBe(2)
      expect(cache.batchCacheSize).toBe(1)
      expect(cache.size).toBe(3)
    })

    it('clears both caches', () => {
      const cache = new QueryPlanCache()

      cache.setSingle('single', { type: 'value' as const, args: null })
      cache.setBatch('batch', { type: 'multi' as const, plans: [] })

      cache.clear()

      expect(cache.getSingle('single')).toBeUndefined()
      expect(cache.getBatch('batch')).toBeUndefined()
      expect(cache.size).toBe(0)
    })
  })
})
