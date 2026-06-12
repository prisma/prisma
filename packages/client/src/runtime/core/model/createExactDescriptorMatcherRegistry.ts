import type {
  DescriptorBoundMatcher,
  DescriptorBoundMatcherContext,
  DescriptorBoundMatcherRegistry,
} from '@prisma/client-common'
import { isObjectEnumValue } from '@prisma/client-runtime-utils'

import { isDecimalJsLike } from '../../utils/decimalJsLike'
import { isSkip } from '../types'

type ExactDescriptorMatcherSpec = {
  model: string
  action: 'findUnique' | 'findFirst' | 'findFirstOrThrow' | 'findMany'
  clientMethod: string
  field: string
  valueType: ExactDescriptorMatcherValueType
  enumValues?: Record<string, string>
  select: string[]
}

type ExactDescriptorMatcherValueType =
  | 'bigint'
  | 'boolean'
  | 'bytes'
  | 'date'
  | 'decimal'
  | 'enum'
  | 'float'
  | 'json'
  | 'number'
  | 'string'

type GeneratedExactDescriptor =
  | { kind: 'constant'; value: unknown }
  | { kind: 'placeholder'; name: string; valueType: string }
  | { kind: 'array'; items: GeneratedExactDescriptor[] }
  | { kind: 'object'; keys: string[]; fields: Record<string, GeneratedExactDescriptor> }

type ExactJsonValue = null | string | number | boolean | ExactJsonValue[] | { [key: string]: ExactJsonValue }

const MAX_INT = 2 ** 31 - 1
const MIN_INT = -(2 ** 31)
const invalidExactJsonValue = Symbol('invalidExactJsonValue')

export function createExactDescriptorMatcherRegistry(
  specs: readonly ExactDescriptorMatcherSpec[],
): DescriptorBoundMatcherRegistry {
  return {
    getMatcher(context) {
      for (let i = 0; i < specs.length; i++) {
        const spec = specs[i]
        if (
          context.model === spec.model &&
          context.action === spec.action &&
          context.clientMethod === spec.clientMethod
        ) {
          let matcher: DescriptorBoundMatcher | undefined
          switch (spec.action) {
            case 'findUnique':
            case 'findFirst':
            case 'findFirstOrThrow':
              matcher = bindWhereSelectMatcher(context, spec)
              break
            case 'findMany':
              matcher = bindFindManyMatcher(context, spec)
              break
          }

          if (matcher !== undefined) {
            return matcher
          }
        }
      }

      return undefined
    },
  }
}

function bindWhereSelectMatcher(
  context: DescriptorBoundMatcherContext,
  spec: ExactDescriptorMatcherSpec,
): DescriptorBoundMatcher | undefined {
  const root = getDescriptorRoot(context)
  if (root === undefined || !descriptorHasKeys(root, ['where', 'select'])) {
    return undefined
  }

  const where = asObjectDescriptor(root.fields.where)
  if (where === undefined || !descriptorHasKeys(where, [spec.field])) {
    return undefined
  }

  const placeholder = asPlaceholderDescriptor(where.fields[spec.field])
  if (
    spec.valueType !== 'bytes' &&
    spec.valueType !== 'date' &&
    spec.valueType !== 'decimal' &&
    spec.valueType !== 'enum' &&
    spec.valueType !== 'json' &&
    placeholder !== undefined &&
    matchesPlaceholderDescriptorValueType(placeholder.valueType, spec.valueType) &&
    matchesSelectDescriptor(root.fields.select, spec.select)
  ) {
    return (args) => matchWhereSelectArgs(args, spec, placeholder.name)
  }

  if (spec.valueType === 'bytes' && matchesSelectDescriptor(root.fields.select, spec.select)) {
    const initialValue = getFindUniqueWhereFieldValue(context.args, spec.field)
    if (ArrayBuffer.isView(initialValue) && isEmptyObjectDescriptor(where.fields[spec.field])) {
      const placeholderName = getSinglePlaceholderNameForValue(context, bytesToBase64(initialValue))
      if (placeholderName !== undefined) {
        return (args) => matchWhereSelectBytesArgs(args, spec, placeholderName)
      }
    }
  }

  if (spec.valueType === 'date' && matchesSelectDescriptor(root.fields.select, spec.select)) {
    const initialValue = getFindUniqueWhereFieldValue(context.args, spec.field)
    if (
      initialValue instanceof Date &&
      Number.isFinite(initialValue.getTime()) &&
      isEmptyObjectDescriptor(where.fields[spec.field])
    ) {
      const placeholderName = getSinglePlaceholderNameForValue(context, initialValue.toISOString())
      if (placeholderName !== undefined) {
        return (args) => matchWhereSelectDateArgs(args, spec, placeholderName)
      }
    }
  }

  if (spec.valueType === 'decimal' && matchesSelectDescriptor(root.fields.select, spec.select)) {
    const initialValue = getFindUniqueWhereFieldValue(context.args, spec.field)
    if (isDecimalJsLike(initialValue)) {
      const placeholderName = getSinglePlaceholderNameForValue(context, initialValue.toFixed())
      if (placeholderName !== undefined) {
        return (args) => matchWhereSelectDecimalArgs(args, spec, placeholderName)
      }
    }
  }

  if (spec.valueType === 'bigint' && matchesSelectDescriptor(root.fields.select, spec.select)) {
    const initialValue = asConstantDescriptorValue(where.fields[spec.field], 'bigint')
    if (initialValue !== undefined) {
      const placeholderName = getSinglePlaceholderNameForValue(context, String(initialValue))
      if (placeholderName !== undefined) {
        return (args) => matchWhereSelectBigIntArgs(args, spec, placeholderName)
      }
    }
  }

  if (spec.valueType === 'enum' && matchesSelectDescriptor(root.fields.select, spec.select)) {
    const initialValue = getFindUniqueWhereFieldValue(context.args, spec.field)
    const initialDbValue = getEnumDbValue(spec, initialValue)
    if (initialDbValue !== undefined) {
      const placeholderName = getSinglePlaceholderNameForValue(context, initialDbValue)
      if (placeholderName !== undefined) {
        return (args) => matchWhereSelectEnumArgs(args, spec, placeholderName)
      }
    }
  }

  if (spec.valueType === 'json' && matchesSelectDescriptor(root.fields.select, spec.select)) {
    const initialValue = getFindUniqueWhereFieldValue(context.args, spec.field)
    const initialJsonValue = stringifyExactJsonValue(initialValue)
    if (initialJsonValue !== undefined) {
      const placeholderName = getSinglePlaceholderNameForValue(context, initialJsonValue)
      if (placeholderName !== undefined) {
        return (args) => matchWhereSelectJsonArgs(args, spec, placeholderName)
      }
    }
  }

  return undefined
}

function bindFindManyMatcher(
  context: DescriptorBoundMatcherContext,
  spec: ExactDescriptorMatcherSpec,
): DescriptorBoundMatcher | undefined {
  const root = getDescriptorRoot(context)
  if (root === undefined || !descriptorHasKeys(root, [spec.field, 'select'])) {
    return undefined
  }

  if (!matchesSelectDescriptor(root.fields.select, spec.select)) {
    return undefined
  }

  const value = root.fields[spec.field]
  const placeholder = asPlaceholderDescriptor(value)
  if (placeholder !== undefined) {
    return matchesPlaceholderDescriptorValueType(placeholder.valueType, spec.valueType)
      ? (args) => matchFindManyPlaceholderArgs(args, spec, placeholder.name)
      : undefined
  }

  const constant = asConstantDescriptorValue(value, spec.valueType)
  return constant !== undefined ? (args) => matchFindManyConstantArgs(args, spec, constant) : undefined
}

function matchWhereSelectArgs(
  args: unknown,
  spec: ExactDescriptorMatcherSpec,
  placeholderName: string,
): Record<string, unknown> | undefined {
  if (!isRecord(args) || !hasOwnEnumerableKeysInOrder(args, ['where', 'select'])) {
    return undefined
  }

  const where = args.where
  if (!isRecord(where) || !hasOwnEnumerableKeysInOrder(where, [spec.field])) {
    return undefined
  }

  const value = where[spec.field]
  if (!matchesPrimitiveValueType(value, spec.valueType) || !matchesSelectArgs(args.select, spec.select)) {
    return undefined
  }

  return { [placeholderName]: value }
}

function matchWhereSelectBigIntArgs(
  args: unknown,
  spec: ExactDescriptorMatcherSpec,
  placeholderName: string,
): Record<string, unknown> | undefined {
  if (!isRecord(args) || !hasOwnEnumerableKeysInOrder(args, ['where', 'select'])) {
    return undefined
  }

  const where = args.where
  if (!isRecord(where) || !hasOwnEnumerableKeysInOrder(where, [spec.field])) {
    return undefined
  }

  const value = where[spec.field]
  if (typeof value !== 'bigint' || !matchesSelectArgs(args.select, spec.select)) {
    return undefined
  }

  return { [placeholderName]: String(value) }
}

function matchWhereSelectDateArgs(
  args: unknown,
  spec: ExactDescriptorMatcherSpec,
  placeholderName: string,
): Record<string, unknown> | undefined {
  if (!isRecord(args) || !hasOwnEnumerableKeysInOrder(args, ['where', 'select'])) {
    return undefined
  }

  const where = args.where
  if (!isRecord(where) || !hasOwnEnumerableKeysInOrder(where, [spec.field])) {
    return undefined
  }

  const value = where[spec.field]
  if (!(value instanceof Date) || !Number.isFinite(value.getTime()) || !matchesSelectArgs(args.select, spec.select)) {
    return undefined
  }

  return { [placeholderName]: value.toISOString() }
}

function matchWhereSelectBytesArgs(
  args: unknown,
  spec: ExactDescriptorMatcherSpec,
  placeholderName: string,
): Record<string, unknown> | undefined {
  if (!isRecord(args) || !hasOwnEnumerableKeysInOrder(args, ['where', 'select'])) {
    return undefined
  }

  const where = args.where
  if (!isRecord(where) || !hasOwnEnumerableKeysInOrder(where, [spec.field])) {
    return undefined
  }

  const value = where[spec.field]
  if (!ArrayBuffer.isView(value) || !matchesSelectArgs(args.select, spec.select)) {
    return undefined
  }

  return { [placeholderName]: bytesToBase64(value) }
}

function matchWhereSelectDecimalArgs(
  args: unknown,
  spec: ExactDescriptorMatcherSpec,
  placeholderName: string,
): Record<string, unknown> | undefined {
  if (!isRecord(args) || !hasOwnEnumerableKeysInOrder(args, ['where', 'select'])) {
    return undefined
  }

  const where = args.where
  if (!isRecord(where) || !hasOwnEnumerableKeysInOrder(where, [spec.field])) {
    return undefined
  }

  const value = where[spec.field]
  if (!isDecimalJsLike(value) || !matchesSelectArgs(args.select, spec.select)) {
    return undefined
  }

  return { [placeholderName]: value.toFixed() }
}

function matchWhereSelectJsonArgs(
  args: unknown,
  spec: ExactDescriptorMatcherSpec,
  placeholderName: string,
): Record<string, unknown> | undefined {
  if (!isRecord(args) || !hasOwnEnumerableKeysInOrder(args, ['where', 'select'])) {
    return undefined
  }

  const where = args.where
  if (!isRecord(where) || !hasOwnEnumerableKeysInOrder(where, [spec.field])) {
    return undefined
  }

  const value = stringifyExactJsonValue(where[spec.field])
  if (value === undefined || !matchesSelectArgs(args.select, spec.select)) {
    return undefined
  }

  return { [placeholderName]: value }
}

function matchWhereSelectEnumArgs(
  args: unknown,
  spec: ExactDescriptorMatcherSpec,
  placeholderName: string,
): Record<string, unknown> | undefined {
  if (!isRecord(args) || !hasOwnEnumerableKeysInOrder(args, ['where', 'select'])) {
    return undefined
  }

  const where = args.where
  if (!isRecord(where) || !hasOwnEnumerableKeysInOrder(where, [spec.field])) {
    return undefined
  }

  const value = getEnumDbValue(spec, where[spec.field])
  if (value === undefined || !matchesSelectArgs(args.select, spec.select)) {
    return undefined
  }

  return { [placeholderName]: value }
}

function matchFindManyPlaceholderArgs(
  args: unknown,
  spec: ExactDescriptorMatcherSpec,
  placeholderName: string,
): Record<string, unknown> | undefined {
  if (!isRecord(args) || !hasOwnEnumerableKeysInOrder(args, [spec.field, 'select'])) {
    return undefined
  }

  const value = args[spec.field]
  if (!matchesPrimitiveValueType(value, spec.valueType) || !matchesSelectArgs(args.select, spec.select)) {
    return undefined
  }

  return { [placeholderName]: value }
}

function matchFindManyConstantArgs(
  args: unknown,
  spec: ExactDescriptorMatcherSpec,
  expectedValue: unknown,
): Record<string, unknown> | undefined {
  if (!isRecord(args) || !hasOwnEnumerableKeysInOrder(args, [spec.field, 'select'])) {
    return undefined
  }

  if (!Object.is(args[spec.field], expectedValue) || !matchesSelectArgs(args.select, spec.select)) {
    return undefined
  }

  return {}
}

function getDescriptorRoot(
  context: DescriptorBoundMatcherContext,
): Extract<GeneratedExactDescriptor, { kind: 'object' }> | undefined {
  if (!isRecord(context.descriptor)) {
    return undefined
  }

  return asObjectDescriptor(context.descriptor.root)
}

function matchesSelectDescriptor(value: unknown, selectFields: readonly string[]): boolean {
  const select = asObjectDescriptor(value)
  if (select === undefined || !descriptorHasKeys(select, selectFields)) {
    return false
  }

  for (let i = 0; i < selectFields.length; i++) {
    if (!isConstantDescriptor(select.fields[selectFields[i]], true)) {
      return false
    }
  }

  return true
}

function matchesSelectArgs(value: unknown, selectFields: readonly string[]): boolean {
  if (!isRecord(value) || !hasOwnEnumerableKeysInOrder(value, selectFields)) {
    return false
  }

  for (let i = 0; i < selectFields.length; i++) {
    if (value[selectFields[i]] !== true) {
      return false
    }
  }

  return true
}

function asObjectDescriptor(value: unknown): Extract<GeneratedExactDescriptor, { kind: 'object' }> | undefined {
  if (isRecord(value) && value.kind === 'object' && Array.isArray(value.keys) && isRecord(value.fields)) {
    return value as Extract<GeneratedExactDescriptor, { kind: 'object' }>
  }

  return undefined
}

function asPlaceholderDescriptor(
  value: unknown,
): Extract<GeneratedExactDescriptor, { kind: 'placeholder' }> | undefined {
  if (
    isRecord(value) &&
    value.kind === 'placeholder' &&
    typeof value.name === 'string' &&
    typeof value.valueType === 'string'
  ) {
    return value as Extract<GeneratedExactDescriptor, { kind: 'placeholder' }>
  }

  return undefined
}

function isConstantDescriptor(value: unknown, expected: unknown): boolean {
  return isRecord(value) && value.kind === 'constant' && Object.is(value.value, expected)
}

function asConstantDescriptorValue(value: unknown, valueType: ExactDescriptorMatcherValueType): unknown {
  if (
    !isRecord(value) ||
    value.kind !== 'constant' ||
    (valueType === 'date' ? !(value.value instanceof Date) : !matchesPrimitiveValueType(value.value, valueType))
  ) {
    return undefined
  }

  return value.value
}

function matchesPrimitiveValueType(value: unknown, valueType: ExactDescriptorMatcherValueType): boolean {
  switch (valueType) {
    case 'bigint':
      return typeof value === 'bigint'
    case 'boolean':
      return typeof value === 'boolean'
    case 'float':
      return isFiniteFloat(value)
    case 'number':
      return isInt32(value)
    case 'string':
      return typeof value === 'string'
    default:
      return false
  }
}

function isInt32(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && MIN_INT <= value && value <= MAX_INT
}

function isFiniteFloat(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && !Number.isInteger(value)
}

function matchesPlaceholderDescriptorValueType(
  descriptorValueType: string,
  specValueType: ExactDescriptorMatcherValueType,
): boolean {
  return descriptorValueType === descriptorValueTypeForSpec(specValueType)
}

function descriptorValueTypeForSpec(specValueType: ExactDescriptorMatcherValueType): string {
  return specValueType === 'number' ? 'int32' : specValueType
}

function getEnumDbValue(spec: ExactDescriptorMatcherSpec, value: unknown): string | undefined {
  return typeof value === 'string' && spec.enumValues !== undefined && Object.hasOwn(spec.enumValues, value)
    ? spec.enumValues[value]
    : undefined
}

function isEmptyObjectDescriptor(value: unknown): boolean {
  const descriptor = asObjectDescriptor(value)
  return descriptor !== undefined && descriptor.keys.length === 0
}

function getFindUniqueWhereFieldValue(args: unknown, field: string): unknown {
  if (!isRecord(args)) {
    return undefined
  }

  const where = args.where
  return isRecord(where) ? where[field] : undefined
}

function getSinglePlaceholderNameForValue(
  context: DescriptorBoundMatcherContext,
  expectedValue: unknown,
): string | undefined {
  const entries = Object.entries(context.precomputedQueryPlanCacheHit.placeholderValues)
  if (entries.length !== 1) {
    return undefined
  }

  const [name, value] = entries[0]
  return Object.is(value, expectedValue) ? name : undefined
}

function bytesToBase64(value: ArrayBufferView): string {
  const { buffer, byteOffset, byteLength } = value
  return Buffer.from(buffer, byteOffset, byteLength).toString('base64')
}

function stringifyExactJsonValue(value: unknown): string | undefined {
  try {
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean' &&
      !Array.isArray(value) &&
      !isPlainJsonObject(value)
    ) {
      return undefined
    }

    const normalized = normalizeExactJsonValue(value, new Set())
    if (normalized === invalidExactJsonValue) {
      return undefined
    }

    return JSON.stringify(normalized)
  } catch {
    return undefined
  }
}

function normalizeExactJsonValue(value: unknown, seen: Set<object>): ExactJsonValue | typeof invalidExactJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : invalidExactJsonValue
  }

  if (typeof value !== 'object' || isSkip(value) || isObjectEnumValue(value) || ArrayBuffer.isView(value)) {
    return invalidExactJsonValue
  }

  if (seen.has(value)) {
    return invalidExactJsonValue
  }

  seen.add(value)
  try {
    if (Array.isArray(value)) {
      const result = new Array<ExactJsonValue>(value.length)
      for (let i = 0; i < value.length; i++) {
        if (!Object.hasOwn(value, i)) {
          return invalidExactJsonValue
        }

        const item = normalizeExactJsonValue(value[i], seen)
        if (item === invalidExactJsonValue) {
          return invalidExactJsonValue
        }

        result[i] = item
      }

      return result
    }

    if (!isPlainJsonObject(value)) {
      return invalidExactJsonValue
    }

    if (Object.hasOwn(value, '$type') || typeof value.toJSON === 'function') {
      return invalidExactJsonValue
    }

    const keys = Object.keys(value)
    let keyIndex = 0
    for (const key in value) {
      if (!Object.hasOwn(value, key) || keys[keyIndex] !== key) {
        return invalidExactJsonValue
      }
      keyIndex++
    }
    if (keyIndex !== keys.length) {
      return invalidExactJsonValue
    }

    const result: Record<string, ExactJsonValue> = {}
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      const item = normalizeExactJsonValue(value[key], seen)
      if (item === invalidExactJsonValue) {
        return invalidExactJsonValue
      }

      result[key] = item
    }

    return result
  } finally {
    seen.delete(value)
  }
}

function isPlainJsonObject(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function descriptorHasKeys(
  descriptor: Extract<GeneratedExactDescriptor, { kind: 'object' }>,
  expectedKeys: readonly string[],
): boolean {
  if (descriptor.keys.length !== expectedKeys.length) {
    return false
  }

  for (let i = 0; i < expectedKeys.length; i++) {
    const key = expectedKeys[i]
    if (descriptor.keys[i] !== key || !Object.hasOwn(descriptor.fields, key)) {
      return false
    }
  }

  return true
}

function hasOwnEnumerableKeysInOrder(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const keys = Object.keys(value)
  if (keys.length !== expectedKeys.length) {
    return false
  }

  for (let i = 0; i < expectedKeys.length; i++) {
    if (keys[i] !== expectedKeys[i]) {
      return false
    }
  }

  return true
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
