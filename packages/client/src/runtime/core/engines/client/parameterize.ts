/**
 * Query parameterization logic for query plan caching.
 *
 * This module handles the conversion of Prisma queries into parameterized shapes
 * where user data values are replaced with placeholder markers, while extracting
 * the actual values into a separate map.
 */

import { fnv1aHash } from './hash'

const FNV_OFFSET_BASIS = 2166136261

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

function isTaggedValue(value: unknown): value is { $type: string; value: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    '$type' in value &&
    typeof (value as { $type: unknown }).$type === 'string'
  )
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
  if (value === null || value === undefined) {
    hashState.hash = fnv1aHash(value === null ? 'null' : 'undefined', hashState.hash)
    return value
  }

  if (isTaggedValue(value)) {
    // FieldRef is structural, preserve it
    if (value.$type === 'FieldRef') {
      hashState.hash = fnv1aHash(JSON.stringify(value), hashState.hash)
      return value
    }
    // All other tagged values are user data
    const placeholderName = `${path}`
    placeholderValues[placeholderName] = value
    placeholderPaths.push(placeholderName)
    hashState.hash = fnv1aHash(JSON.stringify(PARAM_PLACEHOLDER), hashState.hash)
    hashState.hash = fnv1aHash(placeholderName, hashState.hash)
    return { ...PARAM_PLACEHOLDER, name: placeholderName }
  }

  if (Array.isArray(value)) {
    hashState.hash = fnv1aHash('[', hashState.hash)
    const result = value.map((item, index) =>
      parameterize(item, context, `${path}[${index}]`, key, placeholderValues, placeholderPaths, hashState),
    )
    hashState.hash = fnv1aHash(']', hashState.hash)
    return result
  }

  if (typeof value === 'object') {
    return parameterizeObject(
      value as Record<string, unknown>,
      context,
      path,
      placeholderValues,
      placeholderPaths,
      hashState,
    )
  }

  if (key && STRUCTURAL_VALUE_KEYS.has(key)) {
    hashState.hash = fnv1aHash(String(value), hashState.hash)
    return value
  }

  // In selection context, booleans indicate field selection
  if (context === 'selection' && typeof value === 'boolean') {
    hashState.hash = fnv1aHash(value ? 'T' : 'F', hashState.hash)
    return value
  }

  // In orderBy context, sort directions are structural
  if (context === 'orderBy' && typeof value === 'string' && isSortDirection(value)) {
    hashState.hash = fnv1aHash(value, hashState.hash)
    return value
  }

  // Otherwise, it's a user data value
  const placeholderName = `${path}`
  placeholderValues[placeholderName] = value
  placeholderPaths.push(placeholderName)
  hashState.hash = fnv1aHash(JSON.stringify(PARAM_PLACEHOLDER), hashState.hash)
  hashState.hash = fnv1aHash(placeholderName, hashState.hash)
  return { ...PARAM_PLACEHOLDER, name: placeholderName }
}

/**
 * Parameterize an object by processing each key-value pair.
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

  hashState.hash = fnv1aHash('{', hashState.hash)

  // Sort keys for consistent hashing
  const keys = Object.keys(obj).sort()
  for (const key of keys) {
    const value = obj[key]
    if (isSelectionMarker(key)) {
      hashState.hash = fnv1aHash(key, hashState.hash)
      hashState.hash = fnv1aHash(JSON.stringify(value), hashState.hash)
      result[key] = value
      continue
    }

    hashState.hash = fnv1aHash(key, hashState.hash)

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

  hashState.hash = fnv1aHash('}', hashState.hash)

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
