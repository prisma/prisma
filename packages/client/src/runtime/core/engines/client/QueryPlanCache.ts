import type { QueryPlanNode } from '@prisma/client-engine-runtime'

interface CacheEntry {
  plan: QueryPlanNode
  placeholderPaths: string[]
  fullKey: string
}

type FullKeyGetter = string | (() => string)

export class QueryPlanCache {
  readonly #cache: Map<number, CacheEntry | CacheEntry[]>
  readonly #maxSize: number
  #size: number = 0

  constructor(maxSize = 1000) {
    this.#cache = new Map()
    this.#maxSize = maxSize
  }

  /**
   * Get a cached entry by hash.
   * @param hash - The pre-computed hash of the parameterized query
   * @param fullKey - Either the full key string or a function that computes it lazily.
   *                  Using a function avoids JSON.stringify overhead on cache hits when there's no collision.
   */
  get(hash: number, fullKey: FullKeyGetter): CacheEntry | undefined {
    const entry = this.#cache.get(hash)
    if (!entry) return undefined

    // Single entry (common case, no collision)
    if (!Array.isArray(entry)) {
      // Fast path: trust the hash when there's only one entry
      // The hash was computed during parameterization and includes all structural information
      return entry
    }

    // Collision: need full key comparison - now we need to compute it
    const key = typeof fullKey === 'function' ? fullKey() : fullKey
    return entry.find(e => e.fullKey === key)
  }

  set(hash: number, entry: CacheEntry): void {
    const existing = this.#cache.get(hash)

    if (!existing) {
      if (this.#size >= this.#maxSize) {
        this.#evictOldest()
      }
      this.#cache.set(hash, entry)
      this.#size++
      return
    }

    // Handle collision
    if (Array.isArray(existing)) {
      // Check if this entry already exists
      const existingIndex = existing.findIndex(e => e.fullKey === entry.fullKey)
      if (existingIndex >= 0) {
        // Update existing entry
        existing[existingIndex] = entry
      } else {
        // Add new collision
        existing.push(entry)
        this.#size++
      }
    } else {
      // First collision
      if (existing.fullKey === entry.fullKey) {
        // Same query, update it
        this.#cache.set(hash, entry)
      } else {
        // Different query with same hash
        this.#cache.set(hash, [existing, entry])
        this.#size++
      }
    }
  }

  #evictOldest(): void {
    const firstKey = this.#cache.keys().next().value
    if (firstKey !== undefined) {
      const entry = this.#cache.get(firstKey)
      this.#cache.delete(firstKey)
      this.#size -= Array.isArray(entry) ? entry.length : 1
    }
  }

  clear(): void {
    this.#cache.clear()
    this.#size = 0
  }

  get size(): number {
    return this.#size
  }
}
