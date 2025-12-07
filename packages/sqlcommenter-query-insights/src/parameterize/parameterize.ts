/**
 * Query parameterization logic for Prisma query insights.
 *
 * This module handles the conversion of Prisma queries into parameterized shapes
 * where user data values are replaced with placeholder markers.
 *
 * Design principle: when in doubt, parameterize. We're building query shapes
 * for observability, not actual query parameterization for the query compiler.
 */

/**
 * Placeholder object used to replace parameterized values in query shapes.
 */
export const PARAM_PLACEHOLDER = { $type: 'Param' }

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
function parameterize(value: unknown, context: Context, key?: string): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (isTaggedValue(value)) {
    return value.$type === 'FieldRef' ? value : PARAM_PLACEHOLDER
  }

  if (Array.isArray(value)) {
    return value.map((item) => parameterize(item, context, key))
  }

  if (typeof value === 'object') {
    return parameterizeObject(value as Record<string, unknown>, context)
  }

  if (key && STRUCTURAL_VALUE_KEYS.has(key)) {
    return value
  }

  // In selection context, booleans indicate field selection
  if (context === 'selection' && typeof value === 'boolean') {
    return value
  }

  if (context === 'orderBy' && typeof value === 'string' && isSortDirection(value)) {
    return value
  }

  return PARAM_PLACEHOLDER
}

/**
 * Parameterize an object by processing each key-value pair.
 */
function parameterizeObject(obj: Record<string, unknown>, context: Context): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (isSelectionMarker(key)) {
      result[key] = value
      continue
    }

    const childContext = getChildContext(key, context)
    result[key] = parameterize(value, childContext, key)
  }

  return result
}

/**
 * Parameterizes a query object, replacing all user data values with placeholders.
 */
export function parameterizeQuery(query: unknown): unknown {
  return parameterize(query, 'default')
}
