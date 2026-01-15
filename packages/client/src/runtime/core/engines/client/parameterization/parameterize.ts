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
 * Parameterizes a single query using the schema-aware approach.
 *
 * @param query - The query to parameterize
 * @param view - The ParamGraphView for schema lookups
 * @returns The parameterized query with extracted placeholder values
 */
export function parameterizeQuery(query: JsonQuery, view: ParamGraphView): ParameterizeResult {
  const parameterizer = new Parameterizer(view)

  const rootKey = query.modelName ? `${query.modelName}.${query.action}` : query.action
  const root = view.root(rootKey)

  const parameterizedQuery: JsonQuery = {
    ...query,
    query: parameterizer.parameterizeFieldSelection(query.query, root?.a, root?.o, 'query'),
  }

  return {
    parameterizedQuery,
    placeholderValues: parameterizer.getPlaceholderValues(),
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
  const parameterizer = new Parameterizer(view)
  const parameterizedQueries: JsonQuery[] = []

  for (let i = 0; i < batch.batch.length; i++) {
    const query = batch.batch[i]

    const rootKey = query.modelName ? `${query.modelName}.${query.action}` : query.action
    const root = view.root(rootKey)

    parameterizedQueries.push({
      ...query,
      query: parameterizer.parameterizeFieldSelection(query.query, root?.a, root?.o, `batch[${i}].query`),
    })
  }

  return {
    parameterizedBatch: { ...batch, batch: parameterizedQueries },
    placeholderValues: parameterizer.getPlaceholderValues(),
  }
}

/**
 * Encapsulates the state and logic for parameterizing queries.
 */
class Parameterizer {
  readonly #view: ParamGraphView
  readonly #placeholders = new Map<string, unknown>()
  readonly #valueToPlaceholder = new Map<string, string>()

  constructor(view: ParamGraphView) {
    this.#view = view
  }

  /**
   * Returns the collected placeholder values as a plain object.
   */
  getPlaceholderValues(): Record<string, unknown> {
    return Object.fromEntries(this.#placeholders)
  }

  /**
   * Gets or creates a placeholder for the given value.
   * If a placeholder already exists for this value, returns a reference to the existing path.
   * Otherwise, registers a new placeholder at the given path.
   */
  #getOrCreatePlaceholder(value: unknown, type: PlaceholderType, path: string): PlaceholderTaggedValue {
    const valueKey = createValueKey(value, type)
    const existingPath = this.#valueToPlaceholder.get(valueKey)

    if (existingPath !== undefined) {
      return createPlaceholder(existingPath, type)
    }

    this.#valueToPlaceholder.set(valueKey, path)
    this.#placeholders.set(path, value)
    return createPlaceholder(path, type)
  }

  /**
   * Parameterizes a field selection (arguments + selection).
   */
  parameterizeFieldSelection(
    sel: JsonFieldSelection,
    argsNodeId: number | undefined,
    outNodeId: number | undefined,
    path: string,
  ): JsonFieldSelection {
    const argsNode = this.#view.inputNode(argsNodeId)
    const outNode = this.#view.outputNode(outNodeId)

    const result: JsonFieldSelection = { ...sel }

    // Process arguments using input node
    if (sel.arguments && sel.arguments.$type !== 'Raw') {
      result.arguments = this.#parameterizeObject(
        sel.arguments as Record<string, unknown>,
        argsNode,
        `${path}.arguments`,
      )
    }

    // Process selection using output node
    if (sel.selection) {
      result.selection = this.#parameterizeSelection(sel.selection, outNode, `${path}.selection`)
    }

    return result
  }

  /**
   * Parameterizes an object by traversing its fields with the input node.
   */
  #parameterizeObject(
    obj: Record<string, unknown>,
    node: InputNode | undefined,
    path: string,
  ): Record<string, JsonArgumentValue> {
    if (!node) {
      // No parameterizable fields in this subtree - return as-is
      return obj as Record<string, JsonArgumentValue>
    }

    const result: Record<string, JsonArgumentValue> = {}

    for (const [key, value] of Object.entries(obj)) {
      const edge = this.#view.inputEdge(node, key)
      const fieldPath = `${path}.${key}`

      if (edge) {
        result[key] = this.#parameterizeValue(value, edge, fieldPath) as JsonArgumentValue
      } else {
        result[key] = value as JsonArgumentValue
      }
    }

    return result
  }

  /**
   * Core parameterization logic for a single value.
   */
  #parameterizeValue(value: unknown, edge: InputEdge, path: string): unknown {
    const classified = classifyValue(value)

    switch (classified.kind) {
      case 'null':
        // Null values are never parameterized - they affect query semantics
        return value

      case 'structural':
        return value

      case 'primitive':
        return this.#handlePrimitive(classified.value, edge, path)

      case 'taggedScalar':
        return this.#handleTaggedScalar(value as JsonInputTaggedValue, classified.tag, edge, path)

      case 'array':
        return this.#handleArray(classified.items, value, edge, path)

      case 'object':
        return this.#handleObject(classified.entries, edge, path)

      default:
        throw new Error(`Unknown value kind ${(classified satisfies never as ValueClass).kind}`)
    }
  }

  /**
   * Handles parameterization of primitive values (string, number, boolean).
   */
  #handlePrimitive(value: string | number | boolean, edge: InputEdge, path: string): JsonArgumentValue {
    if (hasFlag(edge, EdgeFlag.ParamEnum) && edge.e !== undefined && typeof value === 'string') {
      const enumValues = this.#view.enumValues(edge)
      if (enumValues?.includes(value)) {
        const type: PlaceholderType = { type: 'Enum' }
        return this.#getOrCreatePlaceholder(value, type, path)
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

    return this.#getOrCreatePlaceholder(value, type, path)
  }

  /**
   * Handles parameterization of tagged scalar values (DateTime, Decimal, etc.).
   */
  #handleTaggedScalar(
    tagged: JsonInputTaggedValue,
    tag: JsonInputTaggedValue['$type'],
    edge: InputEdge,
    path: string,
  ): unknown {
    if (!hasFlag(edge, EdgeFlag.ParamScalar)) {
      return tagged
    }

    const mask = getScalarMask(edge)
    if (mask === 0 || !matchesTaggedMask(tag, mask)) {
      return tagged
    }

    const type = getTaggedPlaceholderType(tagged.$type)!
    const decoded = decodeTaggedValue(tagged)

    return this.#getOrCreatePlaceholder(decoded, type, path)
  }

  /**
   * Handles parameterization of array values.
   */
  #handleArray(items: unknown[], originalValue: unknown, edge: InputEdge, path: string): unknown {
    if (hasFlag(edge, EdgeFlag.ParamScalar) && getScalarMask(edge) & ScalarMask.Json) {
      const jsonValue = JSON.stringify(items)
      const type: PlaceholderType = { type: 'Json' }
      return this.#getOrCreatePlaceholder(jsonValue, type, path)
    }

    if (hasFlag(edge, EdgeFlag.ParamEnum)) {
      const enumValues = this.#view.enumValues(edge)
      if (enumValues && items.every((item) => typeof item === 'string' && enumValues.includes(item))) {
        const type: PlaceholderType = { type: 'List', inner: { type: 'Enum' } }
        return this.#getOrCreatePlaceholder(items, type, path)
      }
    }

    if (hasFlag(edge, EdgeFlag.ParamListScalar)) {
      const allValid = items.every((item) => validateListElement(item, edge))
      if (allValid && items.length > 0) {
        const decodedItems = items.map((item) => decodeIfTagged(item))
        const innerType = inferListElementType(items[0])
        const type: PlaceholderType = { type: 'List', inner: innerType }
        return this.#getOrCreatePlaceholder(decodedItems, type, path)
      }
    }

    if (hasFlag(edge, EdgeFlag.ListObject)) {
      const childNode = this.#view.inputNode(edge.c)
      if (childNode) {
        return items.map((item, i) => {
          if (isPlainObject(item)) {
            return this.#parameterizeObject(item, childNode, `${path}[${i}]`)
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
  #handleObject(obj: Record<string, unknown>, edge: InputEdge, path: string): unknown {
    if (hasFlag(edge, EdgeFlag.Object)) {
      const childNode = this.#view.inputNode(edge.c)
      if (childNode) {
        return this.#parameterizeObject(obj, childNode, path)
      }
    }

    const mask = getScalarMask(edge)
    if (mask & ScalarMask.Json) {
      const jsonValue = JSON.stringify(obj)
      const type: PlaceholderType = { type: 'Json' }
      return this.#getOrCreatePlaceholder(jsonValue, type, path)
    }

    return obj
  }

  /**
   * Parameterizes a selection set using output nodes.
   */
  #parameterizeSelection(
    selection: JsonSelectionSet,
    node: ReturnType<ParamGraphView['outputNode']>,
    path: string,
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

      const edge = this.#view.outputEdge(node, key)

      if (edge) {
        // Nested selection with possible args
        const nested = value as { arguments?: Record<string, unknown>; selection?: JsonSelectionSet }
        const fieldPath = `${path}.${key}`

        const argsNode = this.#view.inputNode(edge.a)
        const childOutNode = this.#view.outputNode(edge.o)

        const processedValue: JsonFieldSelection = {
          selection: nested.selection
            ? this.#parameterizeSelection(nested.selection, childOutNode, `${fieldPath}.selection`)
            : {},
        }

        if (nested.arguments) {
          processedValue.arguments = this.#parameterizeObject(nested.arguments, argsNode, `${fieldPath}.arguments`)
        }

        result[key] = processedValue
      } else {
        result[key] = value
      }
    }

    return result
  }
}

/**
 * Creates a placeholder object with the given path.
 */
function createPlaceholder(path: string, type: PlaceholderType): PlaceholderTaggedValue {
  return { $type: 'Param', value: { name: path, ...type } }
}

/**
 * Serializes a PlaceholderType to a string for use as part of a value key.
 */
function serializePlaceholderType(type: PlaceholderType): string {
  if (type.type === 'List') {
    return `List<${serializePlaceholderType(type.inner)}>`
  }
  return type.type
}

/**
 * Serializes a value to a string for use as part of a value key.
 */
function serializeValue(value: unknown): string {
  if (ArrayBuffer.isView(value)) {
    const bufView = Buffer.from(value.buffer, value.byteOffset, value.byteLength)
    return bufView.toString('base64')
  }
  return JSON.stringify(value)
}

/**
 * Creates a unique key for a (value, type) pair.
 * Used to detect when the same value appears at different paths.
 */
function createValueKey(value: unknown, type: PlaceholderType): string {
  const typeKey = serializePlaceholderType(type)
  const valueKey = serializeValue(value)
  return `${typeKey}:${valueKey}`
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
