/**
 * Query parameterization logic for query plan caching.
 *
 * This module handles the conversion of Prisma queries into parameterized shapes
 * where user data values are replaced with placeholder markers, while extracting
 * the actual values into a separate map.
 */

import { JsonBatchQuery, JsonQuery } from '@prisma/json-protocol'

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
const STRUCTURAL_VALUE_KEYS = new Set([
  'take',
  'skip',
  'sort',
  'nulls',
  'mode',
  'relationLoadStrategy',
  'distinct',
  'by',
])

/**
 * Top-level query keys that are structural and should not be parameterized.
 */
const TOP_LEVEL_STRUCTURAL_KEYS = new Set(['modelName', 'action'])

type Context = 'default' | 'selection' | 'orderBy' | 'data'

interface TaggedValue {
  $type: string
  value: unknown
}

function isTaggedValue(value: unknown): value is TaggedValue {
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
  isAtQueryRoot: boolean,
): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (isTaggedValue(value)) {
    // FieldRef is structural, preserve it
    if (value.$type === 'FieldRef') {
      return value
    }
    // All other tagged values are user data
    const placeholderName = path
    placeholderValues[placeholderName] = decodeTaggedValue(value)
    placeholderPaths.push(placeholderName)
    return { ...PARAM_PLACEHOLDER, value: placeholderName }
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      parameterize(item, context, `${path}[${index}]`, key, placeholderValues, placeholderPaths, false),
    )
  }

  if (typeof value === 'object') {
    return parameterizeObject(
      value as Record<string, unknown>,
      context,
      path,
      placeholderValues,
      placeholderPaths,
      isAtQueryRoot,
    )
  }

  if (key && STRUCTURAL_VALUE_KEYS.has(key)) {
    return value
  }

  // In selection context, booleans indicate field selection
  if (context === 'selection' && typeof value === 'boolean') {
    return value
  }

  // In orderBy context, sort directions are structural
  if (context === 'orderBy' && typeof value === 'string' && isSortDirection(value)) {
    return value
  }

  // Otherwise, it's a user data value
  const placeholderName = path
  placeholderValues[placeholderName] = value
  placeholderPaths.push(placeholderName)
  return { ...PARAM_PLACEHOLDER, value: placeholderName }
}

function decodeTaggedValue({ $type, value }: TaggedValue): unknown {
  switch ($type) {
    case 'Bytes':
      return Buffer.from(value as string, 'base64')
    default:
      return value
  }
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
  isAtQueryRoot: boolean,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  // Sort keys for consistent cache keys
  const keys = Object.keys(obj).sort()
  for (const key of keys) {
    const value = obj[key]
    if (isSelectionMarker(key)) {
      result[key] = value
      continue
    }

    // Top-level structural keys should not be parameterized
    if (isAtQueryRoot && TOP_LEVEL_STRUCTURAL_KEYS.has(key)) {
      result[key] = value
      continue
    }

    const childContext = getChildContext(key, context)
    const childPath = path ? `${path}.${key}` : key
    result[key] = parameterize(value, childContext, childPath, key, placeholderValues, placeholderPaths, false)
  }

  return result
}

export interface ParameterizeResult {
  parameterizedQuery: JsonQuery
  placeholderValues: Record<string, unknown>
  placeholderPaths: string[]
}

/**
 * Parameterizes a query object, replacing all user data values with placeholders
 * and extracting the actual values into a separate map.
 *
 * @param query - The query object to parameterize
 * @returns An object containing the parameterized query, placeholder values map, and paths array
 */
export function parameterizeQuery(query: JsonQuery): ParameterizeResult {
  const placeholderValues: Record<string, unknown> = {}
  const placeholderPaths: string[] = []
  const parameterizedQuery = parameterize(
    query,
    'default',
    '',
    undefined,
    placeholderValues,
    placeholderPaths,
    true,
  ) as JsonQuery

  return {
    parameterizedQuery,
    placeholderValues,
    placeholderPaths,
  }
}

export interface ParameterizeBatchResult {
  parameterizedBatch: JsonBatchQuery
  placeholderValues: Record<string, unknown>
  placeholderPaths: string[]
}

/**
 * Parameterizes a batch request, replacing all user data values with placeholders
 * and extracting the actual values into a single combined map.
 *
 * Placeholder names are prefixed with the query index to ensure uniqueness across
 * all queries in the batch (e.g., `batch[0].query.arguments.where.id`).
 *
 * @param batch - The batch request to parameterize
 * @returns An object containing the parameterized batch and combined placeholder values/paths
 */
export function parameterizeBatch(batch: JsonBatchQuery): ParameterizeBatchResult {
  const placeholderValues: Record<string, unknown> = {}
  const placeholderPaths: string[] = []
  const parameterizedQueries: JsonQuery[] = []

  for (let i = 0; i < batch.batch.length; i++) {
    const query = batch.batch[i]
    const queryPlaceholderValues: Record<string, unknown> = {}
    const queryPlaceholderPaths: string[] = []

    const parameterizedQuery = parameterize(
      query,
      'default',
      `batch[${i}]`,
      undefined,
      queryPlaceholderValues,
      queryPlaceholderPaths,
      true,
    ) as JsonQuery

    parameterizedQueries.push(parameterizedQuery)

    Object.assign(placeholderValues, queryPlaceholderValues)
    placeholderPaths.push(...queryPlaceholderPaths)
  }

  return {
    parameterizedBatch: {
      ...batch,
      batch: parameterizedQueries,
    },
    placeholderValues,
    placeholderPaths,
  }
}
