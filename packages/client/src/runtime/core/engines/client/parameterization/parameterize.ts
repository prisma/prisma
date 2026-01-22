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
  JsonInputTaggedValue,
  JsonQuery,
  JsonSelectionSet,
  PlaceholderTaggedValue,
} from '@prisma/json-protocol'
import { PlaceholderType } from '@prisma/json-protocol'
import type { InputEdge, InputNode } from '@prisma/param-graph'
import { EdgeFlag, getScalarMask, hasFlag, ScalarMask } from '@prisma/param-graph'

import { classifyValue, isPlainObject, isTaggedValue, ValueClass } from './classify'
import type { ParamGraphView } from './param-graph-view'

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
 * Map from create field path to the where placeholder path to reuse.
 * Used for upsert to ensure where and create unique fields get the same placeholder.
 */
type UpsertAliasMap = Map<string, string>

/**
 * Creates a placeholder object with the given path.
 */
function createPlaceholder(path: string, type: PlaceholderType): PlaceholderTaggedValue {
  return { $type: 'Param', value: { name: path, ...type } }
}

function resolvePlaceholderPath(path: string, upsertAliasMap?: UpsertAliasMap): string {
  return upsertAliasMap?.get(path) ?? path
}

/**
 * Builds an alias map for upsert operations.
 * Maps create field paths to where field paths when values are equal.
 * Handles both simple unique fields and compound unique constraints.
 */
function buildUpsertAliasMap(
  whereArg: Record<string, unknown>,
  createArg: Record<string, unknown>,
  basePath: string,
): UpsertAliasMap {
  const aliasMap: UpsertAliasMap = new Map()

  for (const [key, value] of Object.entries(whereArg)) {
    if (isPlainObject(value)) {
      // Compound unique: where.{constraintName}.{field} -> create.{field}
      const nested = value as Record<string, unknown>
      for (const [nestedKey, nestedValue] of Object.entries(nested)) {
        if (nestedKey in createArg && valuesAreEqual(nestedValue, createArg[nestedKey])) {
          const createPath = `${basePath}.create.${nestedKey}`
          const wherePath = `${basePath}.where.${key}.${nestedKey}`
          aliasMap.set(createPath, wherePath)
        }
      }
    } else if (key in createArg && valuesAreEqual(value, createArg[key])) {
      // Simple unique: where.{field} -> create.{field}
      const createPath = `${basePath}.create.${key}`
      const wherePath = `${basePath}.where.${key}`
      aliasMap.set(createPath, wherePath)
    }
  }

  return aliasMap
}

function valuesAreEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true
  }

  if (typeof a !== typeof b) {
    return false
  }

  if (typeof a !== 'object' || a === null || b === null) {
    return false
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    return false
  }

  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/**
 * Parameterizes a single query using the schema-aware approach.
 *
 * @param query - The query to parameterize
 * @param view - The ParamGraphView for schema lookups
 * @returns The parameterized query with extracted placeholder values
 */
export function parameterizeQuery(query: JsonQuery, view: ParamGraphView): ParameterizeResult {
  const placeholders = new Map<string, unknown>()

  const rootKey = query.modelName ? `${query.modelName}.${query.action}` : query.action
  const root = view.root(rootKey)

  let upsertAliasMap: UpsertAliasMap | undefined
  if (query.action === 'upsertOne' && query.query.arguments && !('$type' in query.query.arguments)) {
    const args = query.query.arguments as Record<string, unknown>
    const whereArg = args.where
    const createArg = args.create
    if (isPlainObject(whereArg) && isPlainObject(createArg)) {
      upsertAliasMap = buildUpsertAliasMap(whereArg, createArg, 'query.arguments')
    }
  }

  const parameterizedQuery: JsonQuery = {
    ...query,
    query: parameterizeFieldSelection(query.query, root?.a, root?.o, 'query', view, placeholders, upsertAliasMap),
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
export function parameterizeBatch(batch: JsonBatchQuery, view: ParamGraphView): ParameterizeBatchResult {
  const placeholders = new Map<string, unknown>()
  const parameterizedQueries: JsonQuery[] = []

  for (let i = 0; i < batch.batch.length; i++) {
    const query = batch.batch[i]

    const rootKey = query.modelName ? `${query.modelName}.${query.action}` : query.action
    const root = view.root(rootKey)

    let upsertAliasMap: UpsertAliasMap | undefined
    if (query.action === 'upsertOne' && query.query.arguments && !('$type' in query.query.arguments)) {
      const args = query.query.arguments as Record<string, unknown>
      const whereArg = args.where
      const createArg = args.create
      if (isPlainObject(whereArg) && isPlainObject(createArg)) {
        upsertAliasMap = buildUpsertAliasMap(whereArg, createArg, `batch[${i}].query.arguments`)
      }
    }

    parameterizedQueries.push({
      ...query,
      query: parameterizeFieldSelection(
        query.query,
        root?.a,
        root?.o,
        `batch[${i}].query`,
        view,
        placeholders,
        upsertAliasMap,
      ),
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
  upsertAliasMap?: UpsertAliasMap,
): JsonFieldSelection {
  const argsNode = view.inputNode(argsNodeId)
  const outNode = view.outputNode(outNodeId)

  const result: JsonFieldSelection = { ...sel }

  // Process arguments using input node
  if (sel.arguments && sel.arguments.$type !== 'Raw') {
    result.arguments = parameterizeObject(
      sel.arguments as Record<string, unknown>,
      argsNode,
      `${path}.arguments`,
      view,
      placeholders,
      upsertAliasMap,
    )
  }

  // Process selection using output node
  if (sel.selection) {
    result.selection = parameterizeSelection(
      sel.selection,
      outNode,
      `${path}.selection`,
      view,
      placeholders,
      upsertAliasMap,
    )
  }

  return result
}

/**
 * Parameterizes an object by traversing its fields with the input node.
 */
function parameterizeObject(
  obj: Record<string, unknown>,
  node: InputNode | undefined,
  path: string,
  view: ParamGraphView,
  placeholders: Map<string, unknown>,
  upsertAliasMap?: UpsertAliasMap,
): Record<string, JsonArgumentValue> {
  if (!node) {
    // No parameterizable fields in this subtree - return as-is
    return obj as Record<string, JsonArgumentValue>
  }

  const result: Record<string, JsonArgumentValue> = {}

  for (const [key, value] of Object.entries(obj)) {
    const edge = view.inputEdge(node, key)
    const fieldPath = `${path}.${key}`

    if (edge) {
      result[key] = parameterizeValue(value, edge, fieldPath, view, placeholders, upsertAliasMap) as JsonArgumentValue
    } else {
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
  upsertAliasMap?: UpsertAliasMap,
): unknown {
  const classified = classifyValue(value)

  switch (classified.kind) {
    case 'null':
      // Null values are never parameterized - they affect query semantics
      return value

    case 'structural':
      return value

    case 'primitive':
      return handlePrimitive(classified.value, edge, path, view, placeholders, upsertAliasMap)

    case 'taggedScalar':
      return handleTaggedScalar(value as JsonInputTaggedValue, classified.tag, edge, path, placeholders, upsertAliasMap)

    case 'array':
      return handleArray(classified.items, value, edge, path, view, placeholders, upsertAliasMap)

    case 'object':
      return handleObject(classified.entries, edge, path, view, placeholders, upsertAliasMap)

    default:
      throw new Error(`Unknown value kind ${(classified satisfies never as ValueClass).kind}`)
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
  upsertAliasMap?: UpsertAliasMap,
): JsonArgumentValue {
  const placeholderPath = resolvePlaceholderPath(path, upsertAliasMap)

  if (hasFlag(edge, EdgeFlag.ParamEnum) && edge.e !== undefined && typeof value === 'string') {
    const enumValues = view.enumValues(edge)
    if (enumValues?.includes(value)) {
      placeholders.set(placeholderPath, value)
      return createPlaceholder(placeholderPath, { type: 'Enum' })
    }
  }

  if (!hasFlag(edge, EdgeFlag.ParamScalar)) {
    return value
  }

  const mask = getScalarMask(edge)
  if (mask === 0) {
    return value
  }

  const type = getPrimitivePlaceholderType(value)
  if (!matchesPrimitiveMask(type, mask)) {
    return value
  }

  if (mask & ScalarMask.Json) {
    value = JSON.stringify(value)
  }

  placeholders.set(placeholderPath, value)
  return createPlaceholder(placeholderPath, type)
}

/**
 * Handles parameterization of tagged scalar values (DateTime, Decimal, etc.).
 */
function handleTaggedScalar(
  tagged: JsonInputTaggedValue,
  tag: JsonInputTaggedValue['$type'],
  edge: InputEdge,
  path: string,
  placeholders: Map<string, unknown>,
  upsertAliasMap?: UpsertAliasMap,
): unknown {
  if (!hasFlag(edge, EdgeFlag.ParamScalar)) {
    return tagged
  }

  const mask = getScalarMask(edge)
  if (mask === 0 || !matchesTaggedMask(tag, mask)) {
    return tagged
  }

  const type = getTaggedPlaceholderType(tagged.$type)
  const decoded = decodeTaggedValue(tagged)
  const placeholderPath = resolvePlaceholderPath(path, upsertAliasMap)
  placeholders.set(placeholderPath, decoded)
  return createPlaceholder(placeholderPath, type!)
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
  upsertAliasMap?: UpsertAliasMap,
): unknown {
  const placeholderPath = resolvePlaceholderPath(path, upsertAliasMap)

  if (hasFlag(edge, EdgeFlag.ParamScalar) && getScalarMask(edge) & ScalarMask.Json) {
    placeholders.set(placeholderPath, JSON.stringify(items))
    return createPlaceholder(placeholderPath, { type: 'Json' })
  }

  if (hasFlag(edge, EdgeFlag.ParamEnum)) {
    const enumValues = view.enumValues(edge)
    if (enumValues && items.every((item) => typeof item === 'string' && enumValues.includes(item))) {
      placeholders.set(placeholderPath, items)
      return createPlaceholder(placeholderPath, { type: 'List', inner: { type: 'Enum' } })
    }
  }

  if (hasFlag(edge, EdgeFlag.ParamListScalar)) {
    const allValid = items.every((item) => validateListElement(item, edge))
    if (allValid && items.length > 0) {
      const decodedItems = items.map((item) => decodeIfTagged(item))
      placeholders.set(placeholderPath, decodedItems)
      const innerType = inferListElementType(items[0])
      return createPlaceholder(placeholderPath, { type: 'List', inner: innerType })
    }
  }

  if (hasFlag(edge, EdgeFlag.ListObject)) {
    const childNode = view.inputNode(edge.c)
    if (childNode) {
      return items.map((item, i) => {
        if (isPlainObject(item)) {
          return parameterizeObject(item, childNode, `${path}[${i}]`, view, placeholders, upsertAliasMap)
        }
        return item
      })
    }
  }

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
  upsertAliasMap?: UpsertAliasMap,
): unknown {
  if (hasFlag(edge, EdgeFlag.Object)) {
    const childNode = view.inputNode(edge.c)
    if (childNode) {
      return parameterizeObject(obj, childNode, path, view, placeholders, upsertAliasMap)
    }
  }

  const mask = getScalarMask(edge)
  if (mask & ScalarMask.Json) {
    const placeholderPath = resolvePlaceholderPath(path, upsertAliasMap)
    placeholders.set(placeholderPath, JSON.stringify(obj))
    return createPlaceholder(placeholderPath, { type: 'Json' })
  }

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
  upsertAliasMap?: UpsertAliasMap,
): JsonSelectionSet {
  if (!selection || !node) {
    return selection
  }

  const result: JsonSelectionSet = {}

  for (const [key, value] of Object.entries(selection)) {
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
          upsertAliasMap,
        )
      }

      result[key] = processedValue
    } else {
      result[key] = value
    }
  }

  return result
}

const MAX_INT = 2 ** 31 - 1
const MIN_INT = -(2 ** 31)

function getPrimitivePlaceholderType(value: string | number | boolean): PlaceholderType {
  switch (typeof value) {
    case 'boolean':
      return { type: 'Boolean' }

    case 'number':
      if (!Number.isInteger(value)) {
        return { type: 'Float' }
      }
      if (MIN_INT <= value && value <= MAX_INT) {
        return { type: 'Int' }
      }
      return { type: 'BigInt' }

    case 'string':
      return { type: 'String' }

    default:
      throw new Error('unreachable')
  }
}

/**
 * Checks if a primitive value matches the scalar mask.
 */
function matchesPrimitiveMask({ type }: PlaceholderType, mask: number): boolean {
  switch (type) {
    case 'Boolean':
      return (mask & ScalarMask.Boolean) !== 0
    case 'Int':
      return (mask & (ScalarMask.Int | ScalarMask.BigInt | ScalarMask.Float)) !== 0
    case 'BigInt':
      return (mask & ScalarMask.BigInt) !== 0
    case 'Float':
      return (mask & ScalarMask.Float) !== 0
    case 'String':
      return (mask & ScalarMask.String) !== 0
    default:
      return false
  }
}

function getTaggedPlaceholderType(tag: JsonInputTaggedValue['$type']): PlaceholderType | undefined {
  switch (tag) {
    case 'BigInt':
    case 'Bytes':
    case 'DateTime':
    case 'Json':
      return { type: tag }
    case 'Decimal':
      return { type: 'Float' }
    default:
      return undefined
  }
}

/**
 * Infers the placeholder type for an element in a list.
 * Used to determine the inner type of list placeholders.
 */
function inferListElementType(item: unknown): PlaceholderType {
  const classified = classifyValue(item)

  switch (classified.kind) {
    case 'primitive':
      return getPrimitivePlaceholderType(classified.value)
    case 'taggedScalar': {
      const type = getTaggedPlaceholderType(classified.tag)
      return type ?? { type: 'Any' }
    }
    default:
      return { type: 'Any' }
  }
}

/**
 * Checks if a tagged scalar tag matches the scalar mask.
 */
function matchesTaggedMask(tag: JsonInputTaggedValue['$type'], mask: number): boolean {
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
function validateListElement(item: unknown, edge: InputEdge): boolean {
  const classified = classifyValue(item)

  switch (classified.kind) {
    case 'structural':
      return false

    case 'null':
      return false

    case 'primitive': {
      const type = getPrimitivePlaceholderType(classified.value)
      const mask = getScalarMask(edge)
      return mask !== 0 && matchesPrimitiveMask(type, mask)
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
