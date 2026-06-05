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
import { EdgeFlag, getScalarMask, hasFlag, ParamGraph, ScalarMask } from '@prisma/param-graph'

import { deserializeJsonObject } from '../json-protocol'
import { safeJsonStringify } from '../utils'
import { isPlainObject, isTaggedValue } from './classify'

const SCALAR_TAGS = new Set(['DateTime', 'Decimal', 'BigInt', 'Bytes', 'Json', 'Raw'])
const ANY_PLACEHOLDER: PlaceholderType = { type: 'Any' }
const BIGINT_PLACEHOLDER: PlaceholderType = { type: 'BigInt' }
const BOOLEAN_PLACEHOLDER: PlaceholderType = { type: 'Boolean' }
const BYTES_PLACEHOLDER: PlaceholderType = { type: 'Bytes' }
const DATETIME_PLACEHOLDER: PlaceholderType = { type: 'DateTime' }
const ENUM_PLACEHOLDER: PlaceholderType = { type: 'Enum' }
const FLOAT_PLACEHOLDER: PlaceholderType = { type: 'Float' }
const INT_PLACEHOLDER: PlaceholderType = { type: 'Int' }
const JSON_PLACEHOLDER: PlaceholderType = { type: 'Json' }
const STRING_PLACEHOLDER: PlaceholderType = { type: 'String' }
const EMPTY_PLACEHOLDER_VALUES: Record<string, unknown> = Object.freeze({})

interface FirstPlaceholder {
  key?: string
  name: string
  type: PlaceholderType
  value: unknown
}

/**
 * Result of parameterizing a single query.
 */
export interface ParameterizeResult {
  /** The query with user data values replaced by placeholders */
  parameterizedQuery: JsonQuery
  /** Map of placeholder names to their actual values */
  placeholderValues: Record<string, unknown>
}

/**
 * Result of parameterizing a batch of queries.
 */
export interface ParameterizeBatchResult {
  /** The batch with user data values replaced by placeholders */
  parameterizedBatch: JsonBatchQuery
  /** Combined map of placeholder names to their actual values */
  placeholderValues: Record<string, unknown>
}

/**
 * Parameterizes a single query using the schema-aware approach.
 *
 * @param query - The query to parameterize
 * @param view - The ParamGraph for schema lookups
 * @returns The parameterized query with extracted placeholder values
 */
export function parameterizeQuery(query: JsonQuery, view: ParamGraph): ParameterizeResult {
  const parameterizer = new Parameterizer(view)

  const rootKey = query.modelName ? `${query.modelName}.${query.action}` : query.action
  const root = view.root(rootKey)

  const parameterizedFieldSelection = parameterizer.parameterizeFieldSelection(
    query.query,
    root?.argsNodeId,
    root?.outputNodeId,
  )
  const parameterizedQuery: JsonQuery =
    parameterizedFieldSelection === query.query ? query : { ...query, query: parameterizedFieldSelection }

  return {
    parameterizedQuery,
    placeholderValues: parameterizer.getPlaceholderValues(),
  }
}

/**
 * Parameterizes a batch of queries using the schema-aware approach.
 *
 * @param batch - The batch to parameterize
 * @param view - The ParamGraph for schema lookups
 * @returns The parameterized batch with extracted placeholder values
 */
export function parameterizeBatch(batch: JsonBatchQuery, view: ParamGraph): ParameterizeBatchResult {
  const parameterizer = new Parameterizer(view)
  let parameterizedQueries: JsonQuery[] | undefined

  for (let i = 0; i < batch.batch.length; i++) {
    const query = batch.batch[i]

    const rootKey = query.modelName ? `${query.modelName}.${query.action}` : query.action
    const root = view.root(rootKey)
    const parameterizedFieldSelection = parameterizer.parameterizeFieldSelection(
      query.query,
      root?.argsNodeId,
      root?.outputNodeId,
    )
    const parameterizedQuery =
      parameterizedFieldSelection === query.query ? query : { ...query, query: parameterizedFieldSelection }

    if (parameterizedQuery !== query && parameterizedQueries === undefined) {
      parameterizedQueries = batch.batch.slice(0, i)
    }
    if (parameterizedQueries !== undefined) {
      parameterizedQueries[i] = parameterizedQuery
    }
  }

  return {
    parameterizedBatch: parameterizedQueries === undefined ? batch : { ...batch, batch: parameterizedQueries },
    placeholderValues: parameterizer.getPlaceholderValues(),
  }
}

/**
 * Encapsulates the state and logic for parameterizing queries.
 */
class Parameterizer {
  readonly #view: ParamGraph
  #placeholderValues: Record<string, unknown> | undefined
  #valueToPlaceholder: Map<string, string> | undefined
  #firstPlaceholder: FirstPlaceholder | undefined
  #nextPlaceholderId = 1

  constructor(view: ParamGraph) {
    this.#view = view
  }

  /**
   * Returns the collected placeholder values as a plain object.
   */
  getPlaceholderValues(): Record<string, unknown> {
    return this.#placeholderValues ?? EMPTY_PLACEHOLDER_VALUES
  }

  /**
   * Gets or creates a placeholder for the given value.
   * If a placeholder already exists for this value, returns a reference to the existing name.
   * Otherwise, registers a new placeholder with a sequential name.
   * We reuse the placeholders for equal values because the query compiler needs to be able
   * to compare the values for equality for certain optimizations (at the time of writing,
   * only for deciding whether to use native or emulated upserts).
   */
  #getOrCreatePlaceholder(value: unknown, type: PlaceholderType): PlaceholderTaggedValue {
    const valueToPlaceholder = this.#valueToPlaceholder

    if (valueToPlaceholder !== undefined) {
      const valueKey = createValueKey(value, type)
      const existingName = valueToPlaceholder.get(valueKey)

      if (existingName !== undefined) {
        return createPlaceholder(existingName, type)
      }

      const name = `%${this.#nextPlaceholderId++}`
      const placeholderValues = (this.#placeholderValues ??= {})
      valueToPlaceholder.set(valueKey, name)
      placeholderValues[name] = value
      return createPlaceholder(name, type)
    }

    const firstPlaceholder = this.#firstPlaceholder
    if (firstPlaceholder !== undefined) {
      const firstKey = (firstPlaceholder.key ??= createValueKey(firstPlaceholder.value, firstPlaceholder.type))
      const valueKey = createValueKey(value, type)

      if (valueKey === firstKey) {
        return createPlaceholder(firstPlaceholder.name, type)
      }

      const name = `%${this.#nextPlaceholderId++}`
      const placeholderValues = (this.#placeholderValues ??= {})
      const newValueToPlaceholder = (this.#valueToPlaceholder = new Map())
      newValueToPlaceholder.set(firstKey, firstPlaceholder.name)
      newValueToPlaceholder.set(valueKey, name)
      placeholderValues[name] = value
      return createPlaceholder(name, type)
    }

    const name = `%${this.#nextPlaceholderId++}`
    const placeholderValues = (this.#placeholderValues ??= {})
    this.#firstPlaceholder = { name, type, value }
    placeholderValues[name] = value
    return createPlaceholder(name, type)
  }

  /**
   * Parameterizes a field selection (arguments + selection).
   */
  parameterizeFieldSelection(
    sel: JsonFieldSelection,
    argsNodeId: number | undefined,
    outNodeId: number | undefined,
  ): JsonFieldSelection {
    const argsNode = this.#view.inputNode(argsNodeId)
    const outNode = this.#view.outputNode(outNodeId)

    let result: JsonFieldSelection | undefined

    if (sel.arguments && sel.arguments.$type !== 'Raw') {
      const argumentsResult = this.#parameterizeObject(sel.arguments as Record<string, unknown>, argsNode)
      if (argumentsResult !== sel.arguments) {
        result = { ...sel, arguments: argumentsResult }
      }
    }

    if (sel.selection) {
      const selection = this.#parameterizeSelection(sel.selection, outNode)
      if (selection !== sel.selection) {
        result = { ...(result ?? sel), selection }
      }
    }

    return result ?? sel
  }

  /**
   * Parameterizes an object by traversing its fields with the input node.
   */
  #parameterizeObject(obj: Record<string, unknown>, node: InputNode | undefined): Record<string, JsonArgumentValue> {
    if (!node) {
      // No parameterizable fields in this subtree - return as-is
      return obj as Record<string, JsonArgumentValue>
    }

    let result: Record<string, JsonArgumentValue> | undefined
    const keys = Object.keys(obj)

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const edge = this.#view.inputEdge(node, key)
      const value = obj[key]
      const nextValue = edge ? this.#parameterizeValue(value, edge) : value

      if (nextValue !== value && result === undefined) {
        result = {}
        for (let previous = 0; previous < i; previous++) {
          const previousKey = keys[previous]
          result[previousKey] = obj[previousKey] as JsonArgumentValue
        }
      }

      if (result !== undefined) {
        result[key] = nextValue as JsonArgumentValue
      }
    }

    return result ?? (obj as Record<string, JsonArgumentValue>)
  }

  /**
   * Core parameterization logic for a single value.
   */
  #parameterizeValue(value: unknown, edge: InputEdge): unknown {
    if (value === null || value === undefined) {
      // Null values are never parameterized - they affect query semantics
      return value
    }

    switch (typeof value) {
      case 'string':
      case 'number':
      case 'boolean':
        return this.#handlePrimitive(value, edge)
      case 'object':
        break
      default:
        return value
    }

    if (Array.isArray(value)) {
      return this.#handleArray(value, value, edge)
    }

    const obj = value as Record<string, unknown>
    const tag = scalarTag(obj)
    if (tag !== undefined) {
      return this.#handleTaggedScalar(value as JsonInputTaggedValue, tag, edge)
    }

    if ('$type' in obj && typeof obj.$type === 'string') {
      return value
    }

    return this.#handleObject(obj, edge)
  }

  /**
   * Handles parameterization of primitive values (string, number, boolean).
   */
  #handlePrimitive(value: string | number | boolean, edge: InputEdge): JsonArgumentValue {
    if (hasFlag(edge, EdgeFlag.ParamEnum) && edge.enumNameIndex !== undefined && typeof value === 'string') {
      const enumValues = this.#view.enumValues(edge)
      if (enumValues && Object.hasOwn(enumValues, value)) {
        return this.#getOrCreatePlaceholder(enumValues[value], ENUM_PLACEHOLDER)
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

    return this.#getOrCreatePlaceholder(value, type)
  }

  /**
   * Handles parameterization of tagged scalar values (DateTime, Decimal, etc.).
   */
  #handleTaggedScalar(tagged: JsonInputTaggedValue, tag: JsonInputTaggedValue['$type'], edge: InputEdge): unknown {
    if (!hasFlag(edge, EdgeFlag.ParamScalar)) {
      return tagged
    }

    const mask = getScalarMask(edge)
    if (mask === 0 || !matchesTaggedMask(tag, mask)) {
      return tagged
    }

    const type = getTaggedPlaceholderType(tagged.$type)!
    const decoded = decodeTaggedValue(tagged)

    return this.#getOrCreatePlaceholder(decoded, type)
  }

  /**
   * Handles parameterization of array values.
   */
  #handleArray(items: unknown[], originalValue: unknown, edge: InputEdge): unknown {
    if (hasFlag(edge, EdgeFlag.ParamScalar) && getScalarMask(edge) & ScalarMask.Json) {
      const jsonValue = safeJsonStringify(deserializeJsonObject(items))
      return this.#getOrCreatePlaceholder(jsonValue, JSON_PLACEHOLDER)
    }

    if (hasFlag(edge, EdgeFlag.ParamEnum)) {
      const enumValues = this.#view.enumValues(edge)
      if (enumValues) {
        let allEnumValues = true
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          if (typeof item !== 'string' || !Object.hasOwn(enumValues, item)) {
            allEnumValues = false
            break
          }
        }

        if (allEnumValues) {
          const type: PlaceholderType = { type: 'List', inner: ENUM_PLACEHOLDER }
          return this.#getOrCreatePlaceholder(items, type)
        }
      }
    }

    if (hasFlag(edge, EdgeFlag.ParamListScalar)) {
      let allValid = true
      for (let i = 0; i < items.length; i++) {
        if (!validateListElement(items[i], edge)) {
          allValid = false
          break
        }
      }

      if (allValid && items.length > 0) {
        let decodedItems: unknown[] | undefined
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          const decoded = decodeIfTagged(item)
          if (decoded !== item && decodedItems === undefined) {
            decodedItems = items.slice(0, i)
          }
          if (decodedItems !== undefined) {
            decodedItems[i] = decoded
          }
        }
        const innerType = inferListElementType(items)
        const type: PlaceholderType = { type: 'List', inner: innerType }
        return this.#getOrCreatePlaceholder(decodedItems ?? items, type)
      }
    }

    if (hasFlag(edge, EdgeFlag.ListObject)) {
      const childNode = this.#view.inputNode(edge.childNodeId)
      if (childNode) {
        let result: unknown[] | undefined
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          const nextItem = isPlainObject(item) ? this.#parameterizeObject(item, childNode) : item

          if (nextItem !== item && result === undefined) {
            result = items.slice(0, i)
          }
          if (result !== undefined) {
            result[i] = nextItem
          }
        }
        return result ?? originalValue
      }
    }

    return originalValue
  }

  /**
   * Handles parameterization of object values.
   */
  #handleObject(obj: Record<string, unknown>, edge: InputEdge): unknown {
    if (hasFlag(edge, EdgeFlag.Object)) {
      const childNode = this.#view.inputNode(edge.childNodeId)
      if (childNode) {
        return this.#parameterizeObject(obj, childNode)
      }
    }

    const mask = getScalarMask(edge)
    if (mask & ScalarMask.Json) {
      const jsonValue = safeJsonStringify(deserializeJsonObject(obj))
      return this.#getOrCreatePlaceholder(jsonValue, JSON_PLACEHOLDER)
    }

    return obj
  }

  /**
   * Parameterizes a selection set using output nodes.
   */
  #parameterizeSelection(selection: JsonSelectionSet, node: ReturnType<ParamGraph['outputNode']>): JsonSelectionSet {
    if (!selection || !node) {
      return selection
    }

    let result: JsonSelectionSet | undefined
    const keys = Object.keys(selection)

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const value = selection[key]
      let nextValue = value

      if (key !== '$scalars' && key !== '$composites' && typeof value !== 'boolean') {
        const edge = this.#view.outputEdge(node, key)

        if (edge) {
          const nested = value as { arguments?: Record<string, unknown>; selection?: JsonSelectionSet }

          const argsNode = this.#view.inputNode(edge.argsNodeId)
          const childOutNode = this.#view.outputNode(edge.outputNodeId)

          const processedSelection = nested.selection ? this.#parameterizeSelection(nested.selection, childOutNode) : {}
          const processedArguments = nested.arguments ? this.#parameterizeObject(nested.arguments, argsNode) : undefined

          if (processedSelection !== nested.selection || processedArguments !== nested.arguments) {
            const processedValue: JsonFieldSelection = {
              selection: processedSelection,
            }

            if (processedArguments !== undefined) {
              processedValue.arguments = processedArguments
            }

            nextValue = processedValue
          }
        }
      }

      if (nextValue !== value && result === undefined) {
        result = {}
        for (let previous = 0; previous < i; previous++) {
          const previousKey = keys[previous]
          result[previousKey] = selection[previousKey]
        }
      }

      if (result !== undefined) {
        result[key] = nextValue
      }
    }

    return result ?? selection
  }
}

/**
 * Creates a placeholder object with the given name.
 */
function createPlaceholder(name: string, type: PlaceholderType): PlaceholderTaggedValue {
  if (type.type === 'List') {
    return { $type: 'Param', value: { name, type: 'List', inner: type.inner } }
  }
  return { $type: 'Param', value: { name, type: type.type } }
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
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'null'
  }
  if (ArrayBuffer.isView(value)) {
    const bufView = Buffer.from(value.buffer, value.byteOffset, value.byteLength)
    return bufView.toString('base64')
  }
  return JSON.stringify(value)
}

/**
 * Creates a unique key for a (value, type) pair.
 * Used to detect when the same value appears multiple times.
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
      return BOOLEAN_PLACEHOLDER

    case 'number':
      if (!Number.isInteger(value)) {
        return FLOAT_PLACEHOLDER
      }
      if (MIN_INT <= value && value <= MAX_INT) {
        return INT_PLACEHOLDER
      }
      return BIGINT_PLACEHOLDER

    case 'string':
      return STRING_PLACEHOLDER

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
      return BIGINT_PLACEHOLDER
    case 'Bytes':
      return BYTES_PLACEHOLDER
    case 'DateTime':
      return DATETIME_PLACEHOLDER
    case 'Json':
      return JSON_PLACEHOLDER
    case 'Decimal':
      // PrismaValueType doesn't have a Decimal variant and treats both Floats
      // and Decimal as decimals
      return FLOAT_PLACEHOLDER
    default:
      return undefined
  }
}

/**
 * Infers the widest placeholder type that accommodates all elements in a list.
 * For example, a list containing both Int and Float values infers Float.
 */
function inferListElementType(items: unknown[]): PlaceholderType {
  let widest: PlaceholderType = ANY_PLACEHOLDER

  for (const item of items) {
    let itemType: PlaceholderType

    switch (typeof item) {
      case 'string':
      case 'number':
      case 'boolean':
        itemType = getPrimitivePlaceholderType(item)
        break
      case 'object': {
        const tag = item !== null ? scalarTag(item as Record<string, unknown>) : undefined
        if (tag === undefined) {
          return ANY_PLACEHOLDER
        }
        itemType = getTaggedPlaceholderType(tag) ?? ANY_PLACEHOLDER
        break
      }
      default:
        return ANY_PLACEHOLDER
    }

    widest = widenType(widest, itemType)
  }

  return widest
}

/**
 * Returns the wider of two placeholder types, following numeric promotion rules:
 * Int -> BigInt -> Float. Non-numeric types must match exactly or produce Any.
 */
function widenType(a: PlaceholderType, b: PlaceholderType): PlaceholderType {
  if (a.type === 'Any') return b
  if (b.type === 'Any') return a
  if (a.type === b.type) return a

  const NUMERIC_WIDTH: Partial<Record<PlaceholderType['type'], number>> = { Int: 0, BigInt: 1, Float: 2 }
  const aWidth = NUMERIC_WIDTH[a.type]
  const bWidth = NUMERIC_WIDTH[b.type]

  if (aWidth !== undefined && bWidth !== undefined) {
    return aWidth >= bWidth ? a : b
  }

  return ANY_PLACEHOLDER
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
  switch (typeof item) {
    case 'undefined':
    case 'bigint':
    case 'function':
    case 'symbol':
      return false

    case 'object':
      if (item === null) {
        return false
      }
      break

    case 'string':
    case 'number':
    case 'boolean': {
      const type = getPrimitivePlaceholderType(item)
      const mask = getScalarMask(edge)
      return mask !== 0 && matchesPrimitiveMask(type, mask)
    }
  }

  const tag = scalarTag(item as Record<string, unknown>)
  if (tag === undefined) {
    return false
  }

  const mask = getScalarMask(edge)
  return mask !== 0 && matchesTaggedMask(tag, mask)
}

function scalarTag(value: Record<string, unknown>): JsonInputTaggedValue['$type'] | undefined {
  const tag = value.$type
  if (typeof tag !== 'string' || !SCALAR_TAGS.has(tag)) {
    return undefined
  }
  return tag as JsonInputTaggedValue['$type']
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
  return tagged.value
}
