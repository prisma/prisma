import { QueryPlanCache } from './QueryPlanCache'

describe('QueryPlanCache', () => {
  describe('single cache', () => {
    it('stores and retrieves entries', () => {
      const cache = new QueryPlanCache()
      const entry = {
        plan: { type: 'value' as const, args: null },
        placeholderPaths: ['query.arguments.where.id'],
      }

      cache.setSingle('key1', entry)
      const retrieved = cache.getSingle('key1')

      expect(retrieved).toBe(entry)
    })

    it('returns undefined for missing keys', () => {
      const cache = new QueryPlanCache()

      expect(cache.getSingle('nonexistent')).toBeUndefined()
    })

    it('updates existing entries', () => {
      const cache = new QueryPlanCache()
      const entry1 = {
        plan: { type: 'value' as const, args: null },
        placeholderPaths: ['path1'],
      }
      const entry2 = {
        plan: { type: 'value' as const, args: { test: true } },
        placeholderPaths: ['path2'],
      }

      cache.setSingle('key', entry1)
      cache.setSingle('key', entry2)

      expect(cache.getSingle('key')).toBe(entry2)
      expect(cache.singleCacheSize).toBe(1)
    })

    it('evicts oldest entry when at capacity', () => {
      const cache = new QueryPlanCache(2)
      const entry1 = { plan: { type: 'value' as const, args: 1 }, placeholderPaths: [] }
      const entry2 = { plan: { type: 'value' as const, args: 2 }, placeholderPaths: [] }
      const entry3 = { plan: { type: 'value' as const, args: 3 }, placeholderPaths: [] }

      cache.setSingle('key1', entry1)
      cache.setSingle('key2', entry2)
      cache.setSingle('key3', entry3)

      expect(cache.getSingle('key1')).toBeUndefined()
      expect(cache.getSingle('key2')).toBeDefined()
      expect(cache.getSingle('key3')).toBeDefined()
      expect(cache.singleCacheSize).toBe(2)
    })

    it('refreshes entry on get (LRU behavior)', () => {
      const cache = new QueryPlanCache(2)
      const entry1 = { plan: { type: 'value' as const, args: 1 }, placeholderPaths: [] }
      const entry2 = { plan: { type: 'value' as const, args: 2 }, placeholderPaths: [] }
      const entry3 = { plan: { type: 'value' as const, args: 3 }, placeholderPaths: [] }

      cache.setSingle('key1', entry1)
      cache.setSingle('key2', entry2)

      // Access key1 to make it recently used
      cache.getSingle('key1')

      // Add key3, should evict key2 (oldest)
      cache.setSingle('key3', entry3)

      expect(cache.getSingle('key1')).toBeDefined()
      expect(cache.getSingle('key2')).toBeUndefined()
      expect(cache.getSingle('key3')).toBeDefined()
    })
  })

  describe('batch cache', () => {
    it('stores and retrieves batch entries', () => {
      const cache = new QueryPlanCache()
      const entry = {
        response: {
          type: 'multi' as const,
          plans: [
            { type: 'value' as const, args: null },
            { type: 'value' as const, args: null },
          ],
        },
        placeholderPaths: ['batch[0].query.arguments.where.id', 'batch[1].query.arguments.where.id'],
      }

      cache.setBatch('batchKey', entry)
      const retrieved = cache.getBatch('batchKey')

      expect(retrieved).toBe(entry)
    })

    it('returns undefined for missing batch keys', () => {
      const cache = new QueryPlanCache()

      expect(cache.getBatch('nonexistent')).toBeUndefined()
    })

    it('stores compacted batch responses', () => {
      const cache = new QueryPlanCache()
      const entry = {
        response: {
          type: 'compacted' as const,
          plan: { type: 'value' as const, args: null },
          arguments: [{ id: 1 }, { id: 2 }],
          nestedSelection: ['name', 'email'],
          keys: ['id'],
          expectNonEmpty: true,
        },
        placeholderPaths: ['batch[0].query.arguments.where.id', 'batch[1].query.arguments.where.id'],
      }

      cache.setBatch('compactedKey', entry)
      const retrieved = cache.getBatch('compactedKey')

      expect(retrieved).toBe(entry)
      expect(retrieved?.response.type).toBe('compacted')
    })

    it('updates existing batch entries', () => {
      const cache = new QueryPlanCache()
      const entry1 = {
        response: { type: 'multi' as const, plans: [] },
        placeholderPaths: [],
      }
      const entry2 = {
        response: { type: 'multi' as const, plans: [{ type: 'value' as const, args: null }] },
        placeholderPaths: ['updated'],
      }

      cache.setBatch('key', entry1)
      cache.setBatch('key', entry2)

      expect(cache.getBatch('key')).toBe(entry2)
      expect(cache.batchCacheSize).toBe(1)
    })

    it('evicts oldest batch entry when at capacity', () => {
      const cache = new QueryPlanCache(2)
      const makeEntry = (id: number) => ({
        response: { type: 'multi' as const, plans: [{ type: 'value' as const, args: id }] },
        placeholderPaths: [],
      })

      cache.setBatch('key1', makeEntry(1))
      cache.setBatch('key2', makeEntry(2))
      cache.setBatch('key3', makeEntry(3))

      expect(cache.getBatch('key1')).toBeUndefined()
      expect(cache.getBatch('key2')).toBeDefined()
      expect(cache.getBatch('key3')).toBeDefined()
      expect(cache.batchCacheSize).toBe(2)
    })

    it('refreshes batch entry on get (LRU behavior)', () => {
      const cache = new QueryPlanCache(2)
      const makeEntry = (id: number) => ({
        response: { type: 'multi' as const, plans: [{ type: 'value' as const, args: id }] },
        placeholderPaths: [],
      })

      cache.setBatch('key1', makeEntry(1))
      cache.setBatch('key2', makeEntry(2))

      // Access key1 to make it recently used
      cache.getBatch('key1')

      // Add key3, should evict key2 (oldest)
      cache.setBatch('key3', makeEntry(3))

      expect(cache.getBatch('key1')).toBeDefined()
      expect(cache.getBatch('key2')).toBeUndefined()
      expect(cache.getBatch('key3')).toBeDefined()
    })
  })

  describe('combined behavior', () => {
    it('maintains separate caches for single and batch entries', () => {
      const cache = new QueryPlanCache()

      const singleEntry = { plan: { type: 'value' as const, args: 'single' }, placeholderPaths: [] }
      const batchEntry = {
        response: { type: 'multi' as const, plans: [{ type: 'value' as const, args: 'batch' }] },
        placeholderPaths: [],
      }

      cache.setSingle('sharedKey', singleEntry)
      cache.setBatch('sharedKey', batchEntry)

      expect(cache.getSingle('sharedKey')).toBe(singleEntry)
      expect(cache.getBatch('sharedKey')).toBe(batchEntry)
    })

    it('reports combined size', () => {
      const cache = new QueryPlanCache()

      cache.setSingle('single1', { plan: { type: 'value' as const, args: null }, placeholderPaths: [] })
      cache.setSingle('single2', { plan: { type: 'value' as const, args: null }, placeholderPaths: [] })
      cache.setBatch('batch1', { response: { type: 'multi' as const, plans: [] }, placeholderPaths: [] })

      expect(cache.singleCacheSize).toBe(2)
      expect(cache.batchCacheSize).toBe(1)
      expect(cache.size).toBe(3)
    })

    it('clears both caches', () => {
      const cache = new QueryPlanCache()

      cache.setSingle('single', { plan: { type: 'value' as const, args: null }, placeholderPaths: [] })
      cache.setBatch('batch', { response: { type: 'multi' as const, plans: [] }, placeholderPaths: [] })

      cache.clear()

      expect(cache.getSingle('single')).toBeUndefined()
      expect(cache.getBatch('batch')).toBeUndefined()
      expect(cache.size).toBe(0)
    })
  })
})
