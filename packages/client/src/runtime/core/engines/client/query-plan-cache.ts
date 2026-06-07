import type { BatchResponse, QueryPlanNode } from '@prisma/client-engine-runtime'

type InternedStringCounts = Map<string, number>
type InternedQueryCounts = Map<InternedQuery, number>
type InternedResultNodeCounts = Map<InternedResultNode, number>

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

const MIN_INTERNED_STRING_LENGTH = 32

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
      internedStrings,
      internedQueries: internedQueries.size === 0 ? undefined : internedQueries,
      internedResultNodes: internedResultNodes.size === 0 ? undefined : internedResultNodes,
    }
  }

  #internSharedQueries<T>(value: T, counts: InternedQueryCounts): T {
    this.#internSharedQueriesInner(value, false, counts)
    return value
  }

  #internSharedQueriesInner(value: unknown, inJoinChild: boolean, counts: InternedQueryCounts): void {
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
    if ((record.type === 'query' || record.type === 'execute') && inJoinChild && 'args' in record) {
      record.args = this.#internQuery(record.args, counts)
      return
    }

    if (record.type === 'join') {
      const args = record.args as Record<string, unknown> | undefined
      if (args !== undefined) {
        this.#internSharedQueriesInner(args.parent, inJoinChild, counts)
        const children = args.children
        if (Array.isArray(children)) {
          for (let i = 0; i < children.length; i++) {
            const child = children[i] as { child?: unknown }
            this.#internSharedQueriesInner(child.child, true, counts)
          }
        }
      }
      return
    }

    for (const key of Object.keys(record)) {
      this.#internSharedQueriesInner(record[key], inJoinChild, counts)
    }
  }

  #internRawNestedReadQuery(value: unknown, counts: InternedQueryCounts): unknown {
    this.#internRawNestedReadQueryRelations(value, counts)
    return this.#internQuery(value, counts)
  }

  #internRawNestedReadQueryRelations(value: unknown, counts: InternedQueryCounts): void {
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
      } else if (relation[0] === 'm') {
        relation[2] = this.#internQuery(relation[2], counts)
        if (Array.isArray(relation[3])) {
          relation[3] = this.#internRawNestedReadQuery(relation[3], counts)
        }
      }
    }
  }

  #internQuery(value: unknown, counts: InternedQueryCounts): unknown {
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

  #internNestedResultNodes<T>(value: T, counts: InternedResultNodeCounts): T {
    this.#internNestedResultNodesInner(value, counts)
    return value
  }

  #internNestedResultNodesInner(value: unknown, counts: InternedResultNodeCounts): void {
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
    if (record.type === 'dataMap') {
      const args = record.args as Record<string, unknown> | undefined
      if (args !== undefined) {
        this.#internNestedResultNodesInner(args.expr, counts)
        args.structure = this.#internResultNode(args.structure, true, counts)
      }
      return
    }

    for (const key of Object.keys(record)) {
      this.#internNestedResultNodesInner(record[key], counts)
    }
  }

  #internResultNode<T>(value: T, isRoot: boolean, counts: InternedResultNodeCounts): T {
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
      if (record.type === 'object' && isRecord(record.fields)) {
        const fields = record.fields
        for (const key of Object.keys(fields)) {
          fields[key] = this.#internResultNode(fields[key], false, counts)
        }
        return isRoot ? value : (this.#internResultNodeValue(value, counts) as T)
      }

      for (const key of Object.keys(record)) {
        record[key] = this.#internResultNode(record[key], false, counts)
      }
      return isRoot ? value : (this.#internResultNodeValue(value, counts) as T)
    }

    return value
  }

  #internResultNodeValue(value: unknown, counts: InternedResultNodeCounts): unknown {
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

  #releaseInternedQueries(counts: InternedQueryCounts | undefined): void {
    if (counts === undefined) {
      return
    }

    for (const [interned, count] of counts) {
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

    for (const [interned, count] of counts) {
      interned.refCount -= count
      if (interned.refCount <= 0) {
        this.#resultNodeInterner.delete(interned.key)
      }
    }
  }
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
