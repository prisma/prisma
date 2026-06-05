import type { BatchResponse, QueryPlanNode } from '@prisma/client-engine-runtime'

type CacheEntry =
  | { kind: 'single'; key: string; value: QueryPlanNode; previous?: CacheEntry; next?: CacheEntry }
  | { kind: 'batch'; key: string; value: BatchResponse; previous?: CacheEntry; next?: CacheEntry }

// todo: store the query plan for the individual queries in a non-compacted batch
// in the `#singleCache` so that it's possible to reuse them for compatible queries
// outside of the batch in the future and avoid compiling them individually.
export class QueryPlanCache {
  readonly #singleCache: Map<string, Extract<CacheEntry, { kind: 'single' }>>
  readonly #batchCache: Map<string, Extract<CacheEntry, { kind: 'batch' }>>
  readonly #maxSize: number
  #head?: CacheEntry
  #tail?: CacheEntry
  #size = 0

  constructor(maxSize = 1000) {
    this.#singleCache = new Map()
    this.#batchCache = new Map()
    this.#maxSize = maxSize
  }

  getSingle(key: string): QueryPlanNode | undefined {
    const entry = this.#singleCache.get(key)
    if (entry !== undefined) {
      this.#touch(entry)
      return entry.value
    }
    return undefined
  }

  setSingle(key: string, plan: QueryPlanNode): void {
    if (this.#maxSize === 0) {
      return
    }

    const entry = this.#singleCache.get(key)
    if (entry !== undefined) {
      entry.value = plan
      this.#touch(entry)
      return
    }

    this.#append({ kind: 'single', key, value: plan })
    this.#evictIfNeeded()
  }

  getBatch(key: string): BatchResponse | undefined {
    const entry = this.#batchCache.get(key)
    if (entry !== undefined) {
      this.#touch(entry)
      return entry.value
    }
    return undefined
  }

  setBatch(key: string, response: BatchResponse): void {
    if (this.#maxSize === 0) {
      return
    }

    const entry = this.#batchCache.get(key)
    if (entry !== undefined) {
      entry.value = response
      this.#touch(entry)
      return
    }

    this.#append({ kind: 'batch', key, value: response })
    this.#evictIfNeeded()
  }

  clear(): void {
    this.#singleCache.clear()
    this.#batchCache.clear()
    this.#head = undefined
    this.#tail = undefined
    this.#size = 0
  }

  get size(): number {
    return this.#size
  }

  get singleCacheSize(): number {
    return this.#singleCache.size
  }

  get batchCacheSize(): number {
    return this.#batchCache.size
  }

  #touch(entry: CacheEntry): void {
    if (entry === this.#tail) {
      return
    }

    this.#unlink(entry)
    this.#linkAtTail(entry)
  }

  #evictIfNeeded(): void {
    while (this.#size > this.#maxSize) {
      const entry = this.#head
      if (entry === undefined) {
        return
      }

      this.#unlink(entry)
      this.#deleteFromCache(entry)
    }
  }

  #append(entry: CacheEntry): void {
    if (entry.kind === 'single') {
      this.#singleCache.set(entry.key, entry)
    } else {
      this.#batchCache.set(entry.key, entry)
    }

    this.#linkAtTail(entry)
    this.#size++
  }

  #linkAtTail(entry: CacheEntry): void {
    entry.previous = this.#tail
    entry.next = undefined

    if (this.#tail !== undefined) {
      this.#tail.next = entry
    }
    this.#tail = entry

    if (this.#head === undefined) {
      this.#head = entry
    }
  }

  #unlink(entry: CacheEntry): void {
    if (entry.previous !== undefined) {
      entry.previous.next = entry.next
    } else {
      this.#head = entry.next
    }

    if (entry.next !== undefined) {
      entry.next.previous = entry.previous
    } else {
      this.#tail = entry.previous
    }

    entry.previous = undefined
    entry.next = undefined
  }

  #deleteFromCache(entry: CacheEntry): void {
    if (entry.kind === 'single') {
      this.#singleCache.delete(entry.key)
    } else {
      this.#batchCache.delete(entry.key)
    }
    this.#size--
  }
}
