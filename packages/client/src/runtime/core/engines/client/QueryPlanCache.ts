import type { QueryPlanNode } from '@prisma/client-engine-runtime'

interface CacheEntry {
  plan: QueryPlanNode
  placeholderPaths: string[]
}

export class QueryPlanCache {
  readonly #cache: Map<string, CacheEntry>
  readonly #maxSize: number

  constructor(maxSize = 1000) {
    this.#cache = new Map()
    this.#maxSize = maxSize
  }

  get(key: string): CacheEntry | undefined {
    const entry = this.#cache.get(key)
    if (entry) {
      // Move to end for LRU behavior
      this.#cache.delete(key)
      this.#cache.set(key, entry)
    }
    return entry
  }

  set(key: string, entry: CacheEntry): void {
    if (this.#cache.has(key)) {
      // Update existing entry (also moves to end for LRU)
      this.#cache.delete(key)
      this.#cache.set(key, entry)
      return
    }

    // Evict oldest if at capacity
    if (this.#cache.size >= this.#maxSize) {
      const firstKey = this.#cache.keys().next().value
      if (firstKey !== undefined) {
        this.#cache.delete(firstKey)
      }
    }

    this.#cache.set(key, entry)
  }

  clear(): void {
    this.#cache.clear()
  }

  get size(): number {
    return this.#cache.size
  }
}
