/**
 * Query parameterization logic for query plan caching.
 *
 * This module handles the conversion of Prisma queries into parameterized shapes
 * where user data values are replaced with placeholder markers, while extracting
 * the actual values into a separate map.
 *
 * Performance optimizations:
 * - Pre-computed hash seeds for common tokens
 * - Inlined type checks
 * - Minimal object allocation
 * - Avoids key sorting (uses insertion-order iteration)
 */

import { fnv1aHash, combineHash } from './hash'

const FNV_OFFSET_BASIS = 2166136261
const FNV_PRIME = 16777619

/**
 * Pre-computed hash seeds for common tokens to avoid repeated hashing.
 * These are combined with the running hash using combineHash().
 */
const HASH_SEEDS = {
  OPEN_BRACE: fnv1aHash('{', FNV_OFFSET_BASIS),
  CLOSE_BRACE: fnv1aHash('}', FNV_OFFSET_BASIS),
  OPEN_BRACKET: fnv1aHash('[', FNV_OFFSET_BASIS),
  CLOSE_BRACKET: fnv1aHash(']', FNV_OFFSET_BASIS),
  NULL: fnv1aHash('null', FNV_OFFSET_BASIS),
  UNDEFINED: fnv1aHash('undefined', FNV_OFFSET_BASIS),
  TRUE: fnv1aHash('T', FNV_OFFSET_BASIS),
  FALSE: fnv1aHash('F', FNV_OFFSET_BASIS),
  PARAM: fnv1aHash('$Param', FNV_OFFSET_BASIS),
  ASC: fnv1aHash('asc', FNV_OFFSET_BASIS),
  DESC: fnv1aHash('desc', FNV_OFFSET_BASIS),
}

/**
 * Pre-computed hashes for numeric indices 0-99 (covers most array cases)
 */
const INDEX_HASHES: number[] = []
for (let i = 0; i < 100; i++) {
  INDEX_HASHES[i] = fnv1aHash(`[${i}]`, FNV_OFFSET_BASIS)
}

/**
 * Placeholder object used to replace parameterized values in query shapes.
 */
const PARAM_PLACEHOLDER = { $type: 'Param' }

/**
 * Keys that represent nested relation operations within data contexts.
 * These switch back from data context to default context.
 */
const RELATION_OPERATION_KEYS = new Set([
  'connect',
  'connectOrCreate',
  'disconnect',
  'set',
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
])

/**
 * Keys that switch from data context back to default context.
 */
const STRUCTURAL_KEYS_IN_DATA = new Set([
  'where',
  'select',
  'include',
  'omit',
  '_count',
  '_sum',
  '_avg',
  '_min',
  '_max',
])

/**
 * Keys whose primitive values are structural (not user data).
 */
const STRUCTURAL_VALUE_KEYS = new Set(['take', 'skip', 'sort', 'nulls', 'mode', 'relationLoadStrategy', 'distinct'])

/**
 * Top-level query keys that are structural and should not be parameterized.
 */
const TOP_LEVEL_STRUCTURAL_KEYS = new Set(['modelName', 'action'])

type Context = 'default' | 'selection' | 'orderBy' | 'data'

/**
 * Check if value is a tagged value like DateTime, Decimal, etc.
 * Optimized with early bailout on typeof check.
 */
function isTaggedValue(value: unknown): value is { $type: string; value: unknown } {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as { $type?: unknown }
  return typeof obj.$type === 'string'
}

function isSelectionMarker(key: string): boolean {
  return key === '$scalars' || key === '$composites'
}

function isSortDirection(value: string): boolean {
  return value === 'asc' || value === 'desc'
}

/**
 * Get the context for a child key's value based on the key name and parent context.
 */
function getChildContext(key: string, parentContext: Context): Context {
  // These keys always introduce their specific context
  if (key === 'arguments') return 'default'
  if (key === 'selection') return 'selection'
  if (key === 'orderBy') return 'orderBy'
  if (key === 'data') return 'data'

  // In data context, certain keys escape back to default
  if (parentContext === 'data') {
    if (RELATION_OPERATION_KEYS.has(key) || STRUCTURAL_KEYS_IN_DATA.has(key)) {
      return 'default'
    }
  }

  // Otherwise inherit parent context
  return parentContext
}

/**
 * Recursively parameterize a value based on its context.
 * Optimized for minimal allocations and fast hashing.
 */
function parameterize(
  value: unknown,
  context: Context,
  path: string,
  key: string | undefined,
  placeholderValues: Record<string, unknown>,
  placeholderPaths: string[],
  hashState: { hash: number },
): unknown {
  // Fast path for null/undefined - use pre-computed hashes
  if (value === null) {
    hashState.hash = combineHash(hashState.hash, HASH_SEEDS.NULL)
    return value
  }
  if (value === undefined) {
    hashState.hash = combineHash(hashState.hash, HASH_SEEDS.UNDEFINED)
    return value
  }

  const valueType = typeof value

  // Fast path for primitives (most common in queries)
  if (valueType === 'string') {
    // Check structural cases first
    if (key && STRUCTURAL_VALUE_KEYS.has(key)) {
      hashState.hash = fnv1aHash(value as string, hashState.hash)
      return value
    }
    if (context === 'orderBy' && ((value as string) === 'asc' || (value as string) === 'desc')) {
      hashState.hash = combineHash(hashState.hash, (value as string) === 'asc' ? HASH_SEEDS.ASC : HASH_SEEDS.DESC)
      return value
    }
    // User data - parameterize
    placeholderValues[path] = value
    placeholderPaths.push(path)
    hashState.hash = combineHash(hashState.hash, HASH_SEEDS.PARAM)
    hashState.hash = fnv1aHash(path, hashState.hash)
    return { $type: 'Param', name: path }
  }

  if (valueType === 'number') {
    if (key && STRUCTURAL_VALUE_KEYS.has(key)) {
      hashState.hash = fnv1aHash(String(value), hashState.hash)
      return value
    }
    placeholderValues[path] = value
    placeholderPaths.push(path)
    hashState.hash = combineHash(hashState.hash, HASH_SEEDS.PARAM)
    hashState.hash = fnv1aHash(path, hashState.hash)
    return { $type: 'Param', name: path }
  }

  if (valueType === 'boolean') {
    if (context === 'selection') {
      hashState.hash = combineHash(hashState.hash, value ? HASH_SEEDS.TRUE : HASH_SEEDS.FALSE)
      return value
    }
    if (key && STRUCTURAL_VALUE_KEYS.has(key)) {
      hashState.hash = combineHash(hashState.hash, value ? HASH_SEEDS.TRUE : HASH_SEEDS.FALSE)
      return value
    }
    placeholderValues[path] = value
    placeholderPaths.push(path)
    hashState.hash = combineHash(hashState.hash, HASH_SEEDS.PARAM)
    hashState.hash = fnv1aHash(path, hashState.hash)
    return { $type: 'Param', name: path }
  }

  // Object types
  if (valueType === 'object') {
    // Check for tagged values (DateTime, Decimal, etc.)
    const obj = value as { $type?: string; value?: { _ref?: string; _container?: string } }
    if (obj.$type !== undefined) {
      // FieldRef is structural, preserve it
      if (obj.$type === 'FieldRef') {
        // Hash type and field reference directly instead of JSON.stringify
        hashState.hash = fnv1aHash('FieldRef:', hashState.hash)
        if (obj.value?._ref) {
          hashState.hash = fnv1aHash(obj.value._ref, hashState.hash)
        }
        if (obj.value?._container) {
          hashState.hash = fnv1aHash(obj.value._container, hashState.hash)
        }
        return value
      }
      // All other tagged values are user data
      placeholderValues[path] = value
      placeholderPaths.push(path)
      hashState.hash = combineHash(hashState.hash, HASH_SEEDS.PARAM)
      hashState.hash = fnv1aHash(path, hashState.hash)
      return { $type: 'Param', name: path }
    }

    if (Array.isArray(value)) {
      hashState.hash = combineHash(hashState.hash, HASH_SEEDS.OPEN_BRACKET)
      const len = value.length
      const result = new Array(len)
      for (let i = 0; i < len; i++) {
        // Use pre-computed index hash if available
        const indexPath = i < 100
          ? (path ? path + `[${i}]` : `[${i}]`)
          : `${path}[${i}]`
        if (i < 100) {
          hashState.hash = combineHash(hashState.hash, INDEX_HASHES[i])
        } else {
          hashState.hash = fnv1aHash(`[${i}]`, hashState.hash)
        }
        result[i] = parameterize(value[i], context, indexPath, key, placeholderValues, placeholderPaths, hashState)
      }
      hashState.hash = combineHash(hashState.hash, HASH_SEEDS.CLOSE_BRACKET)
      return result
    }

    return parameterizeObject(
      value as Record<string, unknown>,
      context,
      path,
      placeholderValues,
      placeholderPaths,
      hashState,
    )
  }

  // Fallback for any other type
  return value
}

/**
 * Pre-computed hashes for common object keys
 */
const KEY_HASHES = new Map<string, number>()

function getKeyHash(key: string): number {
  let h = KEY_HASHES.get(key)
  if (h === undefined) {
    h = fnv1aHash(key, FNV_OFFSET_BASIS)
    if (KEY_HASHES.size < 1000) {
      KEY_HASHES.set(key, h)
    }
  }
  return h
}

/**
 * Parameterize an object by processing each key-value pair.
 * Keys are sorted for consistent hashing across different object creation orders.
 */
function parameterizeObject(
  obj: Record<string, unknown>,
  context: Context,
  path: string,
  placeholderValues: Record<string, unknown>,
  placeholderPaths: string[],
  hashState: { hash: number },
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  hashState.hash = combineHash(hashState.hash, HASH_SEEDS.OPEN_BRACE)

  // Sort keys for consistent hashing (required for cache correctness)
  const keys = Object.keys(obj).sort()
  const keyCount = keys.length

  for (let i = 0; i < keyCount; i++) {
    const key = keys[i]
    const value = obj[key]

    // Selection markers are structural
    if (key === '$scalars' || key === '$composites') {
      hashState.hash = combineHash(hashState.hash, getKeyHash(key))
      // Hash the boolean/object value directly
      if (typeof value === 'boolean') {
        hashState.hash = combineHash(hashState.hash, value ? HASH_SEEDS.TRUE : HASH_SEEDS.FALSE)
      } else {
        hashState.hash = fnv1aHash(JSON.stringify(value), hashState.hash)
      }
      result[key] = value
      continue
    }

    hashState.hash = combineHash(hashState.hash, getKeyHash(key))

    // Top-level structural keys should not be parameterized
    if (path === '' && TOP_LEVEL_STRUCTURAL_KEYS.has(key)) {
      hashState.hash = fnv1aHash(String(value), hashState.hash)
      result[key] = value
      continue
    }

    const childContext = getChildContext(key, context)
    const childPath = path ? `${path}.${key}` : key
    result[key] = parameterize(value, childContext, childPath, key, placeholderValues, placeholderPaths, hashState)
  }

  hashState.hash = combineHash(hashState.hash, HASH_SEEDS.CLOSE_BRACE)

  return result
}

export interface ParameterizeResult {
  parameterizedQuery: unknown
  placeholderValues: Record<string, unknown>
  placeholderPaths: string[]
  queryHash: number
}

/**
 * Parameterizes a query object, replacing all user data values with placeholders
 * and extracting the actual values into a separate map.
 *
 * @param query - The query object to parameterize
 * @returns An object containing the parameterized query, placeholder values map, paths array, and pre-computed hash
 */
export function parameterizeQuery(query: unknown): ParameterizeResult {
  const placeholderValues: Record<string, unknown> = {}
  const placeholderPaths: string[] = []
  const hashState = { hash: FNV_OFFSET_BASIS }
  const parameterizedQuery = parameterize(query, 'default', '', undefined, placeholderValues, placeholderPaths, hashState)

  return {
    parameterizedQuery,
    placeholderValues,
    placeholderPaths,
    queryHash: hashState.hash,
  }
}
