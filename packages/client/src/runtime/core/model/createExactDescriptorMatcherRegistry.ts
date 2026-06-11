import type {
  DescriptorBoundMatcher,
  DescriptorBoundMatcherContext,
  DescriptorBoundMatcherRegistry,
} from '@prisma/client-common'

import { isDecimalJsLike } from '../../utils/decimalJsLike'

type ExactDescriptorMatcherSpec = {
  model: string
  action: 'findUnique' | 'findMany'
  clientMethod: string
  field: string
  valueType: ExactDescriptorMatcherValueType
  select: string[]
}

type ExactDescriptorMatcherValueType = 'bigint' | 'boolean' | 'date' | 'decimal' | 'number' | 'string'

type GeneratedExactDescriptor =
  | { kind: 'constant'; value: unknown }
  | { kind: 'placeholder'; name: string; valueType: string }
  | { kind: 'array'; items: GeneratedExactDescriptor[] }
  | { kind: 'object'; keys: string[]; fields: Record<string, GeneratedExactDescriptor> }

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
              matcher = bindFindUniqueMatcher(context, spec)
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

function bindFindUniqueMatcher(
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
    spec.valueType !== 'date' &&
    placeholder !== undefined &&
    placeholder.valueType === spec.valueType &&
    matchesSelectDescriptor(root.fields.select, spec.select)
  ) {
    return (args) => matchFindUniqueArgs(args, spec, placeholder.name)
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
        return (args) => matchFindUniqueDateArgs(args, spec, placeholderName)
      }
    }
  }

  if (spec.valueType === 'decimal' && matchesSelectDescriptor(root.fields.select, spec.select)) {
    const initialValue = getFindUniqueWhereFieldValue(context.args, spec.field)
    if (isDecimalJsLike(initialValue)) {
      const placeholderName = getSinglePlaceholderNameForValue(context, initialValue.toFixed())
      if (placeholderName !== undefined) {
        return (args) => matchFindUniqueDecimalArgs(args, spec, placeholderName)
      }
    }
  }

  if (spec.valueType === 'bigint' && matchesSelectDescriptor(root.fields.select, spec.select)) {
    const initialValue = asConstantDescriptorValue(where.fields[spec.field], 'bigint')
    if (initialValue !== undefined) {
      const placeholderName = getSinglePlaceholderNameForValue(context, String(initialValue))
      if (placeholderName !== undefined) {
        return (args) => matchFindUniqueBigIntArgs(args, spec, placeholderName)
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
    return placeholder.valueType === spec.valueType
      ? (args) => matchFindManyPlaceholderArgs(args, spec, placeholder.name)
      : undefined
  }

  const constant = asConstantDescriptorValue(value, spec.valueType)
  return constant !== undefined ? (args) => matchFindManyConstantArgs(args, spec, constant) : undefined
}

function matchFindUniqueArgs(
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
  if (typeof value !== spec.valueType || !matchesSelectArgs(args.select, spec.select)) {
    return undefined
  }

  return { [placeholderName]: value }
}

function matchFindUniqueBigIntArgs(
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

function matchFindUniqueDateArgs(
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

function matchFindUniqueDecimalArgs(
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

function matchFindManyPlaceholderArgs(
  args: unknown,
  spec: ExactDescriptorMatcherSpec,
  placeholderName: string,
): Record<string, unknown> | undefined {
  if (!isRecord(args) || !hasOwnEnumerableKeysInOrder(args, [spec.field, 'select'])) {
    return undefined
  }

  const value = args[spec.field]
  if (typeof value !== spec.valueType || !matchesSelectArgs(args.select, spec.select)) {
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
    (valueType === 'date' ? !(value.value instanceof Date) : typeof value.value !== valueType)
  ) {
    return undefined
  }

  return value.value
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
