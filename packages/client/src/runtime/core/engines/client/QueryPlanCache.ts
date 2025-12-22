import type { QueryPlanNode } from '@prisma/client-engine-runtime'

interface CacheEntry {
  plan: QueryPlanNode
  placeholderPaths: string[]
  fullKey: string
}

export class QueryPlanCache {
  readonly #cache: Map<number, CacheEntry | CacheEntry[]>
  readonly #maxSize: number
  #size: number = 0

  constructor(maxSize = 1000) {
    this.#cache = new Map()
    this.#maxSize = maxSize
  }

  get(hash: number, fullKey: string): CacheEntry | undefined {
    const entry = this.#cache.get(hash)
    if (!entry) return undefined

    // Single entry (common case, no collision)
    if (!Array.isArray(entry)) {
      // Verify it's the right entry (could be a collision we haven't detected yet)
      if (entry.fullKey === fullKey) {
        return entry
      }
      // Hash collision detected during lookup
      return undefined
    }

    // Collision: need full key comparison
    return entry.find(e => e.fullKey === fullKey)
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
