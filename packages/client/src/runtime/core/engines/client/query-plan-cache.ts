import type { BatchResponse, QueryPlanNode } from '@prisma/client-engine-runtime'

type PreparedInternedStringCounts = Map<string, number>
type PreparedInternedQueryCounts = Map<InternedQuery, number>
type PreparedInternedResultNodeCounts = Map<InternedResultNode, number>
type FlatCounts<T> = (T | number)[]
type InternedStringCounts = FlatCounts<string>
type InternedQueryCounts = FlatCounts<InternedQuery>
type InternedResultNodeCounts = FlatCounts<InternedResultNode>

type CacheEntry =
  | {
      kind: 'single'
      key: string
      value: QueryPlanNode
      internedStrings?: InternedStringCounts
      internedQueries?: InternedQueryCounts
      internedResultNodes?: InternedResultNodeCounts
      previous?: CacheEntry
      next?: CacheEntry
    }
  | {
      kind: 'batch'
      key: string
      value: BatchResponse
      internedStrings?: InternedStringCounts
      internedQueries?: InternedQueryCounts
      internedResultNodes?: InternedResultNodeCounts
      previous?: CacheEntry
      next?: CacheEntry
    }

type InternedString = {
  value: string
  refCount: number
}

type InternedQuery = {
  key: string
  value: unknown
  refCount: number
}

type InternedResultNode = {
  key: string
  value: unknown
  refCount: number
}

export type IndividualQueryPlanCacheEntry = {
  key: string
  plan: QueryPlanNode
}

const MIN_INTERNED_STRING_LENGTH = 128
const RAW_NESTED_SCOPE_PREFIX = '@parent$'

export class QueryPlanCache {
  readonly #singleCache: Map<string, Extract<CacheEntry, { kind: 'single' }>>
  readonly #batchCache: Map<string, Extract<CacheEntry, { kind: 'batch' }>>
  readonly #stringInterner = new Map<string, InternedString>()
  readonly #queryInterner = new Map<string, InternedQuery>()
  readonly #resultNodeInterner = new Map<string, InternedResultNode>()
  readonly #maxSize: number
  #head?: CacheEntry
  #tail?: CacheEntry
  #lastSingleKey?: string
  #lastSingleEntry?: Extract<CacheEntry, { kind: 'single' }>
  #lastBatchKey?: string
  #lastBatchEntry?: Extract<CacheEntry, { kind: 'batch' }>
  #size = 0

  constructor(maxSize = 1000) {
    this.#singleCache = new Map()
    this.#batchCache = new Map()
    this.#maxSize = maxSize
  }

  getSingle(key: string): QueryPlanNode | undefined {
    if (key === this.#lastSingleKey && this.#lastSingleEntry !== undefined) {
      this.#touch(this.#lastSingleEntry)
      return this.#lastSingleEntry.value
    }

    const entry = this.#singleCache.get(key)
    if (entry !== undefined) {
      this.#lastSingleKey = key
      this.#lastSingleEntry = entry
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
      this.#releaseInternedQueries(entry.internedQueries)
      this.#releaseInternedResultNodes(entry.internedResultNodes)
      const prepared = this.#prepareCacheValue(plan)
      entry.value = prepared.value
      entry.internedStrings = prepared.internedStrings
      entry.internedQueries = prepared.internedQueries
      entry.internedResultNodes = prepared.internedResultNodes
      this.#touch(entry)
      return
    }

    const prepared = this.#prepareCacheValue(plan)
    this.#append({
      kind: 'single',
      key,
      value: prepared.value,
      internedStrings: prepared.internedStrings,
      internedQueries: prepared.internedQueries,
      internedResultNodes: prepared.internedResultNodes,
    })
    this.#evictIfNeeded()
  }

  getBatch(key: string): BatchResponse | undefined {
    if (key === this.#lastBatchKey && this.#lastBatchEntry !== undefined) {
      this.#touch(this.#lastBatchEntry)
      return this.#lastBatchEntry.value
    }

    const entry = this.#batchCache.get(key)
    if (entry !== undefined) {
      this.#lastBatchKey = key
      this.#lastBatchEntry = entry
      this.#touch(entry)
      return entry.value
    }
    return undefined
  }

  setBatch(key: string, response: BatchResponse, individualPlans?: IndividualQueryPlanCacheEntry[]): void {
    if (this.#maxSize === 0) {
      return
    }

    if (individualPlans !== undefined && individualPlans.length + 1 <= this.#maxSize) {
      for (let i = 0; i < individualPlans.length; i++) {
        const individualPlan = individualPlans[i]
        this.setSingle(individualPlan.key, individualPlan.plan)
      }
    }

    const entry = this.#batchCache.get(key)
    if (entry !== undefined) {
      this.#releaseInternedStrings(entry.internedStrings)
      this.#releaseInternedQueries(entry.internedQueries)
      this.#releaseInternedResultNodes(entry.internedResultNodes)
      const prepared = this.#prepareCacheValue(response)
      entry.value = prepared.value
      entry.internedStrings = prepared.internedStrings
      entry.internedQueries = prepared.internedQueries
      entry.internedResultNodes = prepared.internedResultNodes
      this.#touch(entry)
      return
    }

    const prepared = this.#prepareCacheValue(response)
    this.#append({
      kind: 'batch',
      key,
      value: prepared.value,
      internedStrings: prepared.internedStrings,
      internedQueries: prepared.internedQueries,
      internedResultNodes: prepared.internedResultNodes,
    })
    this.#evictIfNeeded()
  }

  clear(): void {
    this.#singleCache.clear()
    this.#batchCache.clear()
    this.#head = undefined
    this.#tail = undefined
    this.#lastSingleKey = undefined
    this.#lastSingleEntry = undefined
    this.#lastBatchKey = undefined
    this.#lastBatchEntry = undefined
    this.#size = 0
    this.#stringInterner.clear()
    this.#queryInterner.clear()
    this.#resultNodeInterner.clear()
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

  get maxSize(): number {
    return this.#maxSize
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
      if (entry === this.#lastSingleEntry) {
        this.#lastSingleKey = undefined
        this.#lastSingleEntry = undefined
      }
    } else {
      this.#batchCache.delete(entry.key)
      if (entry === this.#lastBatchEntry) {
        this.#lastBatchKey = undefined
        this.#lastBatchEntry = undefined
      }
    }
    this.#releaseInternedStrings(entry.internedStrings)
    this.#releaseInternedQueries(entry.internedQueries)
    this.#releaseInternedResultNodes(entry.internedResultNodes)
    this.#size--
  }

  #prepareCacheValue<T>(value: T): {
    value: T
    internedStrings?: InternedStringCounts
    internedQueries?: InternedQueryCounts
    internedResultNodes?: InternedResultNodeCounts
  } {
    if (!shouldInternStrings(value)) {
      return { value, internedStrings: undefined, internedQueries: undefined, internedResultNodes: undefined }
    }

    const internedQueries = new Map<InternedQuery, number>()
    const internedResultNodes = new Map<InternedResultNode, number>()
    const internedStrings = new Map<string, number>()
    const withSharedQueries = this.#internSharedQueries(value, internedQueries)
    const withSharedResultNodes = this.#internNestedResultNodes(withSharedQueries, internedResultNodes)
    return {
      value: this.#internStrings(withSharedResultNodes, internedStrings),
      internedStrings: compactCounts(internedStrings),
      internedQueries: compactCounts(internedQueries),
      internedResultNodes: compactCounts(internedResultNodes),
    }
  }

  #internSharedQueries<T>(value: T, counts: PreparedInternedQueryCounts): T {
    this.#internSharedQueriesInner(value, false, counts)
    return value
  }

  #internSharedQueriesInner(value: unknown, inJoinChild: boolean, counts: PreparedInternedQueryCounts): void {
    if (Array.isArray(value)) {
      const tag = value[0]
      if ((tag === 'q' || tag === 'x') && inJoinChild && value.length > 1) {
        value[1] = this.#internQuery(value[1], counts)
        return
      }

      if (tag === 'j') {
        this.#internSharedQueriesInner(value[1], inJoinChild, counts)
        const children = value[2]
        if (Array.isArray(children)) {
          for (let i = 0; i < children.length; i++) {
            const child = children[i]
            if (Array.isArray(child)) {
              this.#internSharedQueriesInner(child[0], true, counts)
            }
          }
        }
        return
      }

      if (tag === 'n' && value.length > 1) {
        this.#internRawNestedReadQueryRelations(value[1], counts)
        return
      }

      for (let i = 0; i < value.length; i++) {
        this.#internSharedQueriesInner(value[i], inJoinChild, counts)
      }
      return
    }

    if (typeof value !== 'object' || value === null) {
      return
    }

    const record = value as Record<string, unknown>
    for (const key of Object.keys(record)) {
      this.#internSharedQueriesInner(record[key], inJoinChild, counts)
    }
  }

  #internRawNestedReadQuery(value: unknown, counts: PreparedInternedQueryCounts): unknown {
    this.#internRawNestedReadQueryRelations(value, counts)
    return this.#internQuery(value, counts)
  }

  #internRawNestedReadQueryRelations(value: unknown, counts: PreparedInternedQueryCounts): void {
    if (!Array.isArray(value)) {
      return
    }

    const relations = value[2]
    if (!Array.isArray(relations)) {
      return
    }

    for (let i = 0; i < relations.length; i++) {
      const relation = relations[i]
      if (!Array.isArray(relation)) {
        continue
      }

      if (relation[0] === 'r') {
        if (Array.isArray(relation[2])) {
          relation[2] = this.#internRawNestedReadQuery(relation[2], counts)
        }
      }
    }
  }

  #internQuery(value: unknown, counts: PreparedInternedQueryCounts): unknown {
    const key = JSON.stringify(value)
    let interned = this.#queryInterner.get(key)
    if (interned === undefined) {
      interned = { key, value, refCount: 0 }
      this.#queryInterner.set(key, interned)
    }

    interned.refCount++
    counts.set(interned, (counts.get(interned) ?? 0) + 1)
    return interned.value
  }

  #internNestedResultNodes<T>(value: T, counts: PreparedInternedResultNodeCounts): T {
    this.#internNestedResultNodesInner(value, counts)
    return value
  }

  #internNestedResultNodesInner(value: unknown, counts: PreparedInternedResultNodeCounts): void {
    if (Array.isArray(value)) {
      if (value[0] === 'd' && value.length > 2) {
        this.#internNestedResultNodesInner(value[1], counts)
        value[2] = this.#internResultNode(value[2], true, counts)
        return
      }

      for (let i = 0; i < value.length; i++) {
        this.#internNestedResultNodesInner(value[i], counts)
      }
      return
    }

    if (typeof value !== 'object' || value === null) {
      return
    }

    const record = value as Record<string, unknown>
    for (const key of Object.keys(record)) {
      this.#internNestedResultNodesInner(record[key], counts)
    }
  }

  #internResultNode<T>(value: T, isRoot: boolean, counts: PreparedInternedResultNodeCounts): T {
    if (Array.isArray(value)) {
      if (isCompactResultObjectNode(value)) {
        const fields = value[1]
        for (const key of Object.keys(fields)) {
          fields[key] = this.#internResultNode(fields[key], false, counts)
        }
        return isRoot ? value : (this.#internResultNodeValue(value, counts) as T)
      }

      const items = value as unknown[]
      for (let i = 0; i < items.length; i++) {
        items[i] = this.#internResultNode(items[i], false, counts)
      }
      return isRoot ? value : (this.#internResultNodeValue(value, counts) as T)
    }

    if (typeof value === 'object' && value !== null) {
      const record = value as Record<string, unknown>
      for (const key of Object.keys(record)) {
        record[key] = this.#internResultNode(record[key], false, counts)
      }
      return isRoot ? value : (this.#internResultNodeValue(value, counts) as T)
    }

    return value
  }

  #internResultNodeValue(value: unknown, counts: PreparedInternedResultNodeCounts): unknown {
    const key = JSON.stringify(value)
    let interned = this.#resultNodeInterner.get(key)
    if (interned === undefined) {
      interned = { key, value, refCount: 0 }
      this.#resultNodeInterner.set(key, interned)
    }

    interned.refCount++
    counts.set(interned, (counts.get(interned) ?? 0) + 1)
    return interned.value
  }

  #internStrings<T>(value: T, counts: PreparedInternedStringCounts): T {
    if (typeof value === 'string') {
      if (!shouldInternString(value)) {
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

    for (let i = 0; i < counts.length; i += 2) {
      const value = counts[i] as string
      const count = counts[i + 1] as number
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

  #releaseInternedQueries(counts: InternedQueryCounts | undefined): void {
    if (counts === undefined) {
      return
    }

    for (let i = 0; i < counts.length; i += 2) {
      const interned = counts[i] as InternedQuery
      const count = counts[i + 1] as number
      interned.refCount -= count
      if (interned.refCount <= 0) {
        this.#queryInterner.delete(interned.key)
      }
    }
  }

  #releaseInternedResultNodes(counts: InternedResultNodeCounts | undefined): void {
    if (counts === undefined) {
      return
    }

    for (let i = 0; i < counts.length; i += 2) {
      const interned = counts[i] as InternedResultNode
      const count = counts[i + 1] as number
      interned.refCount -= count
      if (interned.refCount <= 0) {
        this.#resultNodeInterner.delete(interned.key)
      }
    }
  }
}

function compactCounts<T>(counts: Map<T, number>): FlatCounts<T> | undefined {
  if (counts.size === 0) {
    return undefined
  }

  const compacted: FlatCounts<T> = new Array(counts.size * 2)
  let index = 0
  for (const [value, count] of counts) {
    compacted[index++] = value
    compacted[index++] = count
  }
  return compacted
}

function shouldInternString(value: string): boolean {
  return value.length >= MIN_INTERNED_STRING_LENGTH || value.startsWith(RAW_NESTED_SCOPE_PREFIX)
}

function shouldInternStrings(value: unknown): boolean {
  if (Array.isArray(value)) {
    if (value[0] === 'j' || value[0] === 'n') {
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
    for (const key of Object.keys(value)) {
      if (shouldInternStrings((value as Record<string, unknown>)[key])) {
        return true
      }
    }
  }

  return false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCompactResultObjectNode(value: unknown[]): value is [string | null, Record<string, unknown>, boolean?] {
  return (
    (value.length === 2 || value.length === 3) &&
    (typeof value[0] === 'string' || value[0] === null) &&
    isRecord(value[1])
  )
}
