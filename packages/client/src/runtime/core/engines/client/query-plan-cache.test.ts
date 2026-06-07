import type { QueryPlanNode } from '@prisma/client-engine-runtime'

import { QueryPlanCache } from './query-plan-cache'
import { getQueryPlanCacheMaxSize } from './query-plan-cache-size'

const originalTargetBuildType = (globalThis as any).TARGET_BUILD_TYPE

function setTargetBuildType(value: 'client' | 'wasm-compiler-edge') {
  ;(globalThis as any).TARGET_BUILD_TYPE = value
}

afterAll(() => {
  if (originalTargetBuildType === undefined) {
    delete (globalThis as any).TARGET_BUILD_TYPE
  } else {
    ;(globalThis as any).TARGET_BUILD_TYPE = originalTargetBuildType
  }
})

describe('QueryPlanCache', () => {
  describe('max size defaults', () => {
    it('uses a larger default for the Node.js client build', () => {
      setTargetBuildType('client')

      expect(getQueryPlanCacheMaxSize(undefined)).toBe(1000)
    })

    it('uses a smaller default for the edge build', () => {
      setTargetBuildType('wasm-compiler-edge')

      expect(getQueryPlanCacheMaxSize(undefined)).toBe(100)
    })

    it('keeps explicit cache sizes independent of build target', () => {
      setTargetBuildType('wasm-compiler-edge')

      expect(getQueryPlanCacheMaxSize(250)).toBe(250)
    })

    it('keeps zero as the cache-disabled sentinel', () => {
      setTargetBuildType('client')

      expect(getQueryPlanCacheMaxSize(0)).toBeUndefined()
    })
  })

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

    it('clears repeated-hit single entries after eviction', () => {
      const cache = new QueryPlanCache(1)
      const plan1 = { type: 'value' as const, args: 1 }
      const plan2 = { type: 'value' as const, args: 2 }

      cache.setSingle('key1', plan1)
      expect(cache.getSingle('key1')).toBe(plan1)
      expect(cache.getSingle('key1')).toBe(plan1)

      cache.setSingle('key2', plan2)

      expect(cache.getSingle('key1')).toBeUndefined()
      expect(cache.getSingle('key2')).toBe(plan2)
    })

    it('shares repeated child query templates under joins', () => {
      const cache = new QueryPlanCache(2)
      const createDbQuery = (sql: string) => [[sql], ['?', true], [], [], false]
      const createPlan = (rootSql: string): QueryPlanNode =>
        [
          'j',
          ['q', createDbQuery(rootSql)],
          [[['q', createDbQuery('SELECT child WHERE parentId = ')], [['id', 'parentId']], 'children', false]],
          false,
        ] as unknown as QueryPlanNode

      cache.setSingle('key1', createPlan('SELECT root one WHERE id = '))
      cache.setSingle('key2', createPlan('SELECT root two WHERE id = '))

      type InspectableJoinPlan = readonly [
        'j',
        readonly ['q', unknown],
        readonly [readonly [readonly ['q', unknown], unknown, string, boolean]],
        boolean,
      ]
      const plan1 = cache.getSingle('key1') as unknown as InspectableJoinPlan
      const plan2 = cache.getSingle('key2') as unknown as InspectableJoinPlan

      expect(plan1[1][1]).not.toBe(plan2[1][1])
      expect(plan1[2][0][0][1]).toBe(plan2[2][0][0][1])
    })

    it('shares repeated child query templates under raw nested reads', () => {
      const cache = new QueryPlanCache(2)
      const createDbQuery = (sql: string) => [[sql], ['?', true], [], [], false]
      const createPlan = (rootSql: string): QueryPlanNode =>
        [
          'n',
          [
            createDbQuery(rootSql),
            [['id', 'id', 'i']],
            [
              [
                'r',
                'children',
                [createDbQuery('SELECT child WHERE parentId = '), [['id', 'id', 'i']]],
                'id',
                'parentId',
                '@parent$id',
                false,
              ],
            ],
          ],
          true,
        ] as unknown as QueryPlanNode

      cache.setSingle('key1', createPlan('SELECT root one WHERE id = '))
      cache.setSingle('key2', createPlan('SELECT root two WHERE id = '))

      type InspectableRawNestedPlan = readonly [
        'n',
        readonly [
          unknown,
          unknown,
          readonly [readonly ['r', string, readonly [unknown, unknown], string, string, string, boolean]],
        ],
        boolean,
      ]
      const plan1 = cache.getSingle('key1') as unknown as InspectableRawNestedPlan
      const plan2 = cache.getSingle('key2') as unknown as InspectableRawNestedPlan

      expect(plan1[1][0]).not.toBe(plan2[1][0])
      expect(plan1[1][2][0][2][0]).toBe(plan2[1][2][0][2][0])
    })

    it('shares repeated nested result structures under data maps', () => {
      const cache = new QueryPlanCache(2)
      const createDbQuery = (sql: string) => [[sql], ['?', true], [], [], false]
      const createPlan = (rootField: string): QueryPlanNode =>
        [
          'd',
          [
            'j',
            ['q', createDbQuery(`SELECT ${rootField} FROM root WHERE id = `)],
            [
              [
                ['q', createDbQuery('SELECT id, name FROM child WHERE parentId = ')],
                [['id', 'parentId']],
                'children',
                false,
              ],
            ],
            false,
          ],
          [
            null,
            {
              [rootField]: 'i',
              children: [null, { id: 'i', name: 's' }],
            },
          ],
          {},
        ] as unknown as QueryPlanNode

      cache.setSingle('key1', createPlan('firstRootField'))
      cache.setSingle('key2', createPlan('secondRootField'))

      type InspectableDataMapPlan = readonly [
        'd',
        unknown,
        readonly [null, { children: readonly [null, Record<string, unknown>]; [key: string]: unknown }],
        unknown,
      ]
      const plan1 = cache.getSingle('key1') as unknown as InspectableDataMapPlan
      const plan2 = cache.getSingle('key2') as unknown as InspectableDataMapPlan

      expect(plan1[2]).not.toBe(plan2[2])
      expect(plan1[2][1]).not.toBe(plan2[2][1])
      expect(plan1[2][1].children).toBe(plan2[2][1].children)
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

    it('stores individual plans from eligible multi batch entries', () => {
      const cache = new QueryPlanCache(4)
      const plan1 = { type: 'value' as const, args: 'first' }
      const plan2 = { type: 'value' as const, args: 'second' }
      const response = {
        type: 'multi' as const,
        plans: [plan1, plan2],
      }

      cache.setBatch('batchKey', response, [
        { key: 'singleKey1', plan: plan1 },
        { key: 'singleKey2', plan: plan2 },
      ])

      expect(cache.getBatch('batchKey')).toBe(response)
      expect(cache.getSingle('singleKey1')).toBe(plan1)
      expect(cache.getSingle('singleKey2')).toBe(plan2)
      expect(cache.size).toBe(3)
    })

    it('skips individual plans from multi batch entries when they do not fit the cache size', () => {
      const cache = new QueryPlanCache(2)
      const plan1 = { type: 'value' as const, args: 'first' }
      const plan2 = { type: 'value' as const, args: 'second' }
      const response = {
        type: 'multi' as const,
        plans: [plan1, plan2],
      }

      cache.setBatch('batchKey', response, [
        { key: 'singleKey1', plan: plan1 },
        { key: 'singleKey2', plan: plan2 },
      ])

      expect(cache.getBatch('batchKey')).toBe(response)
      expect(cache.getSingle('singleKey1')).toBeUndefined()
      expect(cache.getSingle('singleKey2')).toBeUndefined()
      expect(cache.size).toBe(1)
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

    it('evicts oldest batch entry when at capacity', () => {
      const cache = new QueryPlanCache(2)
      const makeResponse = (id: number) => ({
        type: 'multi' as const,
        plans: [{ type: 'value' as const, args: id }],
      })

      cache.setBatch('key1', makeResponse(1))
      cache.setBatch('key2', makeResponse(2))
      cache.setBatch('key3', makeResponse(3))

      expect(cache.getBatch('key1')).toBeUndefined()
      expect(cache.getBatch('key2')).toBeDefined()
      expect(cache.getBatch('key3')).toBeDefined()
      expect(cache.batchCacheSize).toBe(2)
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

    it('clears repeated-hit batch entries after eviction', () => {
      const cache = new QueryPlanCache(1)
      const makeResponse = (id: number) => ({
        type: 'multi' as const,
        plans: [{ type: 'value' as const, args: id }],
      })
      const response1 = makeResponse(1)
      const response2 = makeResponse(2)

      cache.setBatch('key1', response1)
      expect(cache.getBatch('key1')).toBe(response1)
      expect(cache.getBatch('key1')).toBe(response1)

      cache.setBatch('key2', response2)

      expect(cache.getBatch('key1')).toBeUndefined()
      expect(cache.getBatch('key2')).toBe(response2)
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

    it('evicts the oldest entry across single and batch caches', () => {
      const cache = new QueryPlanCache(2)

      cache.setSingle('single1', { type: 'value' as const, args: 'single1' })
      cache.setBatch('batch1', { type: 'multi' as const, plans: [{ type: 'value' as const, args: 'batch1' }] })
      cache.setSingle('single2', { type: 'value' as const, args: 'single2' })

      expect(cache.getSingle('single1')).toBeUndefined()
      expect(cache.getBatch('batch1')).toBeDefined()
      expect(cache.getSingle('single2')).toBeDefined()
      expect(cache.size).toBe(2)
    })

    it('refreshes entries across single and batch caches on get', () => {
      const cache = new QueryPlanCache(2)

      cache.setSingle('single1', { type: 'value' as const, args: 'single1' })
      cache.setBatch('batch1', { type: 'multi' as const, plans: [{ type: 'value' as const, args: 'batch1' }] })

      cache.getSingle('single1')
      cache.setBatch('batch2', { type: 'multi' as const, plans: [{ type: 'value' as const, args: 'batch2' }] })

      expect(cache.getSingle('single1')).toBeDefined()
      expect(cache.getBatch('batch1')).toBeUndefined()
      expect(cache.getBatch('batch2')).toBeDefined()
      expect(cache.size).toBe(2)
    })

    it('does not store entries when max size is zero', () => {
      const cache = new QueryPlanCache(0)

      cache.setSingle('single', { type: 'value' as const, args: null })
      cache.setBatch('batch', { type: 'multi' as const, plans: [] })

      expect(cache.getSingle('single')).toBeUndefined()
      expect(cache.getBatch('batch')).toBeUndefined()
      expect(cache.size).toBe(0)
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
