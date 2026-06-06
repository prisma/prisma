import type { BatchResponse, QueryPlanNode } from '@prisma/client-engine-runtime'

type InternedStringCounts = Map<string, number>

type CacheEntry =
  | {
      kind: 'single'
      key: string
      value: QueryPlanNode
      internedStrings?: InternedStringCounts
      previous?: CacheEntry
      next?: CacheEntry
    }
  | {
      kind: 'batch'
      key: string
      value: BatchResponse
      internedStrings?: InternedStringCounts
      previous?: CacheEntry
      next?: CacheEntry
    }

type InternedString = {
  value: string
  refCount: number
}

const MIN_INTERNED_STRING_LENGTH = 8

// todo: store the query plan for the individual queries in a non-compacted batch
// in the `#singleCache` so that it's possible to reuse them for compatible queries
// outside of the batch in the future and avoid compiling them individually.
export class QueryPlanCache {
  readonly #singleCache: Map<string, Extract<CacheEntry, { kind: 'single' }>>
  readonly #batchCache: Map<string, Extract<CacheEntry, { kind: 'batch' }>>
  readonly #stringInterner = new Map<string, InternedString>()
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
      this.#releaseInternedStrings(entry.internedStrings)
      const prepared = this.#prepareCacheValue(plan)
      entry.value = prepared.value
      entry.internedStrings = prepared.internedStrings
      this.#touch(entry)
      return
    }

    const prepared = this.#prepareCacheValue(plan)
    this.#append({ kind: 'single', key, value: prepared.value, internedStrings: prepared.internedStrings })
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
      this.#releaseInternedStrings(entry.internedStrings)
      const prepared = this.#prepareCacheValue(response)
      entry.value = prepared.value
      entry.internedStrings = prepared.internedStrings
      this.#touch(entry)
      return
    }

    const prepared = this.#prepareCacheValue(response)
    this.#append({ kind: 'batch', key, value: prepared.value, internedStrings: prepared.internedStrings })
    this.#evictIfNeeded()
  }

  clear(): void {
    this.#singleCache.clear()
    this.#batchCache.clear()
    this.#head = undefined
    this.#tail = undefined
    this.#size = 0
    this.#stringInterner.clear()
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
    this.#releaseInternedStrings(entry.internedStrings)
    this.#size--
  }

  #prepareCacheValue<T>(value: T): { value: T; internedStrings?: InternedStringCounts } {
    if (!shouldInternStrings(value)) {
      return { value, internedStrings: undefined }
    }

    const internedStrings = new Map<string, number>()
    return { value: this.#internStrings(value, internedStrings), internedStrings }
  }

  #internStrings<T>(value: T, counts: InternedStringCounts): T {
    if (typeof value === 'string') {
      if (value.length < MIN_INTERNED_STRING_LENGTH) {
        return value
      }

      let interned = this.#stringInterner.get(value)
      if (interned === undefined) {
        interned = { value, refCount: 0 }
        this.#stringInterner.set(value, interned)
      }

      interned.refCount++
      counts.set(interned.value, (counts.get(interned.value) ?? 0) + 1)
      return interned.value as T
    }

    if (Array.isArray(value)) {
      const items = value as unknown[]
      for (let i = 0; i < items.length; i++) {
        items[i] = this.#internStrings(items[i], counts)
      }
      return value
    }

    if (typeof value === 'object' && value !== null) {
      const record = value as Record<string, unknown>
      for (const key of Object.keys(record)) {
        record[key] = this.#internStrings(record[key], counts)
      }
    }

    return value
  }

  #releaseInternedStrings(counts: InternedStringCounts | undefined): void {
    if (counts === undefined) {
      return
    }

    for (const [value, count] of counts) {
      const interned = this.#stringInterner.get(value)
      if (interned === undefined) {
        continue
      }

      interned.refCount -= count
      if (interned.refCount <= 0) {
        this.#stringInterner.delete(value)
      }
    }
  }
}

function shouldInternStrings(value: unknown): boolean {
  if (Array.isArray(value)) {
    if (value[0] === 'j') {
      return true
    }

    for (let i = 0; i < value.length; i++) {
      if (shouldInternStrings(value[i])) {
        return true
      }
    }

    return false
  }

  if (typeof value === 'object' && value !== null) {
    if ((value as { type?: unknown }).type === 'join') {
      return true
    }

    for (const key of Object.keys(value)) {
      if (shouldInternStrings((value as Record<string, unknown>)[key])) {
        return true
      }
    }
  }

  return false
}
