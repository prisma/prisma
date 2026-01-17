/**
 * Schema-aware traversal algorithm for parameterization.
 *
 * This module implements the core parameterization logic that walks the
 * JsonQuery tree guided by ParamGraph. It only parameterizes values when
 * both schema rules and runtime value types agree.
 */

import type {
  JsonArgumentValue,
  JsonBatchQuery,
  JsonFieldSelection,
  JsonQuery,
  JsonSelectionSet,
} from '@prisma/json-protocol'
import type { InputEdge } from '@prisma/param-graph'
import { EdgeFlag, getScalarMask, hasFlag, ScalarMask } from '@prisma/param-graph'

import { classifyValue, isPlainObject, isTaggedValue } from './classify'
import type { ParamGraphView } from './paramGraphView'

/**
 * Result of parameterizing a single query.
 */
export interface ParameterizeResult {
  /** The query with user data values replaced by placeholders */
  parameterizedQuery: JsonQuery
  /** Map of placeholder paths to their actual values */
  placeholderValues: Record<string, unknown>
}

/**
 * Result of parameterizing a batch of queries.
 */
export interface ParameterizeBatchResult {
  /** The batch with user data values replaced by placeholders */
  parameterizedBatch: JsonBatchQuery
  /** Combined map of placeholder paths to their actual values */
  placeholderValues: Record<string, unknown>
}

/**
 * Marker object for placeholders.
 * Reused to avoid allocation overhead.
 */
const PARAM_MARKER = { $type: 'Param' } as const

/**
 * Creates a placeholder object with the given path.
 */
function createPlaceholder(path: string): { $type: 'Param'; value: string } {
  return { ...PARAM_MARKER, value: path }
}

/**
 * Parameterizes a single query using the schema-aware approach.
 *
 * @param query - The query to parameterize
 * @param view - The ParamGraphView for schema lookups
 * @returns The parameterized query with extracted placeholder values
 */
export function parameterizeQueryWithSchema(query: JsonQuery, view: ParamGraphView): ParameterizeResult {
  const placeholders = new Map<string, unknown>()

  // Find root entry for this operation
  const rootKey = query.modelName ? `${query.modelName}.${query.action}` : query.action

  const root = view.root(rootKey)

  // Process the query
  const parameterizedQuery: JsonQuery = {
    ...query,
    query: parameterizeFieldSelection(query.query, root?.a, root?.o, 'query', view, placeholders),
  }

  return {
    parameterizedQuery,
    placeholderValues: Object.fromEntries(placeholders),
  }
}

/**
 * Parameterizes a batch of queries using the schema-aware approach.
 *
 * @param batch - The batch to parameterize
 * @param view - The ParamGraphView for schema lookups
 * @returns The parameterized batch with extracted placeholder values
 */
export function parameterizeBatchWithSchema(batch: JsonBatchQuery, view: ParamGraphView): ParameterizeBatchResult {
  const placeholders = new Map<string, unknown>()
  const parameterizedQueries: JsonQuery[] = []

  for (let i = 0; i < batch.batch.length; i++) {
    const query = batch.batch[i]

    // Find root entry for this operation
    const rootKey = query.modelName ? `${query.modelName}.${query.action}` : query.action

    const root = view.root(rootKey)

    parameterizedQueries.push({
      ...query,
      query: parameterizeFieldSelection(query.query, root?.a, root?.o, `batch[${i}].query`, view, placeholders),
    })
  }

  return {
    parameterizedBatch: { ...batch, batch: parameterizedQueries },
    placeholderValues: Object.fromEntries(placeholders),
  }
}

/**
 * Parameterizes a field selection (arguments + selection).
 */
function parameterizeFieldSelection(
  sel: JsonFieldSelection,
  argsNodeId: number | undefined,
  outNodeId: number | undefined,
  path: string,
  view: ParamGraphView,
  placeholders: Map<string, unknown>,
): JsonFieldSelection {
  const argsNode = view.inputNode(argsNodeId)
  const outNode = view.outputNode(outNodeId)

  const result: JsonFieldSelection = { ...sel }

  // Process arguments using input node
  if (sel.arguments && typeof sel.arguments === 'object') {
    result.arguments = parameterizeObject(
      sel.arguments as Record<string, unknown>,
      argsNode,
      `${path}.arguments`,
      view,
      placeholders,
    )
  }

  // Process selection using output node
  if (sel.selection) {
    result.selection = parameterizeSelection(sel.selection, outNode, `${path}.selection`, view, placeholders)
  }

  return result
}

/**
 * Parameterizes an object by traversing its fields with the input node.
 */
function parameterizeObject(
  obj: Record<string, unknown>,
  node: ReturnType<ParamGraphView['inputNode']>,
  path: string,
  view: ParamGraphView,
  placeholders: Map<string, unknown>,
): Record<string, JsonArgumentValue> {
  if (!node) {
    // No parameterizable fields in this subtree - return as-is
    return obj as Record<string, JsonArgumentValue>
  }

  const result: Record<string, JsonArgumentValue> = {}

  // Iterate in sorted order for stable cache keys
  const sortedKeys = Object.keys(obj).sort()

  for (const key of sortedKeys) {
    const value = obj[key]
    const edge = view.inputEdge(node, key)
    const fieldPath = `${path}.${key}`

    if (edge) {
      result[key] = parameterizeValue(value, edge, fieldPath, view, placeholders) as JsonArgumentValue
    } else {
      // Unknown field - preserve as-is
      result[key] = value as JsonArgumentValue
    }
  }

  return result
}

/**
 * Core parameterization logic for a single value.
 */
function parameterizeValue(
  value: unknown,
  edge: InputEdge,
  path: string,
  view: ParamGraphView,
  placeholders: Map<string, unknown>,
): unknown {
  const classified = classifyValue(value)

  switch (classified.kind) {
    case 'null':
      // Null values are never parameterized - they affect query semantics
      return value

    case 'structural':
      // FieldRef, Enum, Param, Raw - always preserve
      return value

    case 'primitive':
      return handlePrimitive(classified.value, edge, path, view, placeholders)

    case 'taggedScalar':
      return handleTaggedScalar(value as { $type: string; value: unknown }, classified.tag, edge, path, placeholders)

    case 'array':
      return handleArray(classified.items, value, edge, path, view, placeholders)

    case 'object':
      return handleObject(classified.entries, edge, path, view, placeholders)
  }
}

/**
 * Handles parameterization of primitive values (string, number, boolean).
 */
function handlePrimitive(
  value: string | number | boolean,
  edge: InputEdge,
  path: string,
  view: ParamGraphView,
  placeholders: Map<string, unknown>,
): unknown {
  // Check if this edge allows scalar parameterization
  if (!hasFlag(edge, EdgeFlag.ParamScalar)) {
    return value
  }

  // Validate scalar type matches mask
  const mask = getScalarMask(edge)
  if (mask !== 0 && !matchesPrimitiveMask(value, mask)) {
    return value
  }

  // Check enum membership if required
  if (edge.e !== undefined && typeof value === 'string') {
    const enumValues = view.enumValues(edge)
    if (enumValues && !enumValues.includes(value)) {
      // Invalid enum value - let validation catch it
      return value
    }
  }

  placeholders.set(path, value)
  return createPlaceholder(path)
}

/**
 * Handles parameterization of tagged scalar values (DateTime, Decimal, etc.).
 */
function handleTaggedScalar(
  tagged: { $type: string; value: unknown },
  tag: string,
  edge: InputEdge,
  path: string,
  placeholders: Map<string, unknown>,
): unknown {
  if (!hasFlag(edge, EdgeFlag.ParamScalar)) {
    return tagged
  }

  // Validate tag matches scalar mask
  const mask = getScalarMask(edge)
  if (mask !== 0 && !matchesTaggedMask(tag, mask)) {
    return tagged
  }

  const decoded = decodeTaggedValue(tagged)
  placeholders.set(path, decoded)
  return createPlaceholder(path)
}

/**
 * Handles parameterization of array values.
 */
function handleArray(
  items: unknown[],
  originalValue: unknown,
  edge: InputEdge,
  path: string,
  view: ParamGraphView,
  placeholders: Map<string, unknown>,
): unknown {
  // List of objects - recurse into each element
  if (hasFlag(edge, EdgeFlag.ListObject)) {
    const childNode = view.inputNode(edge.c)
    if (childNode) {
      return items.map((item, i) => {
        if (isPlainObject(item)) {
          return parameterizeObject(item, childNode, `${path}[${i}]`, view, placeholders)
        }
        // Non-object in list-object field - preserve
        return item
      })
    }
  }

  // List of scalars - validate and parameterize whole list
  if (hasFlag(edge, EdgeFlag.ListScalar)) {
    const allValid = items.every((item) => validateListElement(item, edge, view))
    if (allValid) {
      const decodedItems = items.map((item) => decodeIfTagged(item))
      placeholders.set(path, decodedItems)
      return createPlaceholder(path)
    }
  }

  // Preserve as-is
  return originalValue
}

/**
 * Handles parameterization of object values.
 */
function handleObject(
  obj: Record<string, unknown>,
  edge: InputEdge,
  path: string,
  view: ParamGraphView,
  placeholders: Map<string, unknown>,
): unknown {
  // Object field - recurse into child node
  if (hasFlag(edge, EdgeFlag.Object)) {
    const childNode = view.inputNode(edge.c)
    if (childNode) {
      return parameterizeObject(obj, childNode, path, view, placeholders)
    }
  }

  // Json field - parameterize the whole object
  const mask = getScalarMask(edge)
  if (mask & ScalarMask.Json) {
    placeholders.set(path, obj)
    return createPlaceholder(path)
  }

  // Unknown object structure - preserve
  return obj
}

/**
 * Parameterizes a selection set using output nodes.
 */
function parameterizeSelection(
  selection: JsonSelectionSet,
  node: ReturnType<ParamGraphView['outputNode']>,
  path: string,
  view: ParamGraphView,
  placeholders: Map<string, unknown>,
): JsonSelectionSet {
  if (!selection || !node) {
    return selection
  }

  const result: JsonSelectionSet = {}

  for (const [key, value] of Object.entries(selection)) {
    // Preserve special markers and boolean selections
    if (key === '$scalars' || key === '$composites' || typeof value === 'boolean') {
      result[key] = value
      continue
    }

    const edge = view.outputEdge(node, key)

    if (edge) {
      // Nested selection with possible args
      const nested = value as { arguments?: Record<string, unknown>; selection?: JsonSelectionSet }
      const fieldPath = `${path}.${key}`

      const argsNode = view.inputNode(edge.a)
      const childOutNode = view.outputNode(edge.o)

      const processedValue: JsonFieldSelection = {
        selection: nested.selection
          ? parameterizeSelection(nested.selection, childOutNode, `${fieldPath}.selection`, view, placeholders)
          : {},
      }

      if (nested.arguments) {
        processedValue.arguments = parameterizeObject(
          nested.arguments,
          argsNode,
          `${fieldPath}.arguments`,
          view,
          placeholders,
        )
      }

      result[key] = processedValue
    } else {
      // Unknown field - preserve as-is
      result[key] = value
    }
  }

  return result
}

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Checks if a primitive value matches the scalar mask.
 */
function matchesPrimitiveMask(value: string | number | boolean, mask: number): boolean {
  if (typeof value === 'string') return (mask & ScalarMask.String) !== 0
  if (typeof value === 'number') return (mask & ScalarMask.Number) !== 0
  if (typeof value === 'boolean') return (mask & ScalarMask.Boolean) !== 0
  return false
}

/**
 * Checks if a tagged scalar tag matches the scalar mask.
 */
function matchesTaggedMask(tag: string, mask: number): boolean {
  switch (tag) {
    case 'DateTime':
      return (mask & ScalarMask.DateTime) !== 0
    case 'Decimal':
      return (mask & ScalarMask.Decimal) !== 0
    case 'BigInt':
      return (mask & ScalarMask.BigInt) !== 0
    case 'Bytes':
      return (mask & ScalarMask.Bytes) !== 0
    case 'Json':
      return (mask & ScalarMask.Json) !== 0
    default:
      return false
  }
}

/**
 * Validates that a list element can be parameterized.
 */
function validateListElement(item: unknown, edge: InputEdge, view: ParamGraphView): boolean {
  const classified = classifyValue(item)

  switch (classified.kind) {
    case 'structural':
      // FieldRef/Enum in list - don't parameterize list
      return false

    case 'null':
      // Null in list - don't parameterize list
      return false

    case 'primitive': {
      const mask = getScalarMask(edge)
      if (mask !== 0 && !matchesPrimitiveMask(classified.value, mask)) {
        return false
      }
      if (edge.e !== undefined && typeof classified.value === 'string') {
        const enumValues = view.enumValues(edge)
        return enumValues?.includes(classified.value) ?? false
      }
      return true
    }

    case 'taggedScalar': {
      const mask = getScalarMask(edge)
      return mask !== 0 && matchesTaggedMask(classified.tag, mask)
    }

    default:
      return false
  }
}

/**
 * Decodes a value if it's a tagged scalar, otherwise returns as-is.
 */
function decodeIfTagged(value: unknown): unknown {
  if (isTaggedValue(value)) {
    return decodeTaggedValue(value)
  }
  return value
}

/**
 * Decodes a tagged scalar value to its raw form.
 */
function decodeTaggedValue(tagged: { $type: string; value: unknown }): unknown {
  if (tagged.$type === 'Bytes') {
    return Buffer.from(tagged.value as string, 'base64')
  }
  return tagged.value
}
