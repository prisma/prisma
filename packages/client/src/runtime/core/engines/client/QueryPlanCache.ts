import type { BatchResponse, QueryPlanNode } from '@prisma/client-engine-runtime'

interface SingleCacheEntry {
  plan: QueryPlanNode
  placeholderPaths: string[]
}

interface BatchCacheEntry {
  response: BatchResponse
  placeholderPaths: string[]
}

export class QueryPlanCache {
  readonly #singleCache: Map<string, SingleCacheEntry>
  readonly #batchCache: Map<string, BatchCacheEntry>
  readonly #maxSize: number

  constructor(maxSize = 1000) {
    this.#singleCache = new Map()
    this.#batchCache = new Map()
    this.#maxSize = maxSize
  }

  getSingle(key: string): SingleCacheEntry | undefined {
    const entry = this.#singleCache.get(key)
    if (entry) {
      // Move to end for LRU behavior
      this.#singleCache.delete(key)
      this.#singleCache.set(key, entry)
    }
    return entry
  }

  setSingle(key: string, entry: SingleCacheEntry): void {
    if (this.#singleCache.has(key)) {
      // Update existing entry (also moves to end for LRU)
      this.#singleCache.delete(key)
      this.#singleCache.set(key, entry)
      return
    }

    // Evict oldest if at capacity
    if (this.#singleCache.size >= this.#maxSize) {
      const firstKey = this.#singleCache.keys().next().value
      if (firstKey !== undefined) {
        this.#singleCache.delete(firstKey)
      }
    }

    this.#singleCache.set(key, entry)
  }

  getBatch(key: string): BatchCacheEntry | undefined {
    const entry = this.#batchCache.get(key)
    if (entry) {
      // Move to end for LRU behavior
      this.#batchCache.delete(key)
      this.#batchCache.set(key, entry)
    }
    return entry
  }

  setBatch(key: string, entry: BatchCacheEntry): void {
    if (this.#batchCache.has(key)) {
      // Update existing entry (also moves to end for LRU)
      this.#batchCache.delete(key)
      this.#batchCache.set(key, entry)
      return
    }

    // Evict oldest if at capacity
    if (this.#batchCache.size >= this.#maxSize) {
      const firstKey = this.#batchCache.keys().next().value
      if (firstKey !== undefined) {
        this.#batchCache.delete(firstKey)
      }
    }

    this.#batchCache.set(key, entry)
  }

  clear(): void {
    this.#singleCache.clear()
    this.#batchCache.clear()
  }

  get size(): number {
    return this.#singleCache.size + this.#batchCache.size
  }

  get singleCacheSize(): number {
    return this.#singleCache.size
  }

  get batchCacheSize(): number {
    return this.#batchCache.size
  }
}
