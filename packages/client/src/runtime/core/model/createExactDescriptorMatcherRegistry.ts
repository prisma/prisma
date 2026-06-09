import type {
  DescriptorBoundMatcher,
  DescriptorBoundMatcherContext,
  DescriptorBoundMatcherRegistry,
} from '@prisma/client-common'

type ExactDescriptorMatcherSpec = {
  model: string
  action: 'findUnique' | 'findMany'
  clientMethod: string
  field: string
  valueType: 'number' | 'string'
  select: string[]
}

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
          switch (spec.action) {
            case 'findUnique':
              return bindFindUniqueMatcher(context, spec)
            case 'findMany':
              return bindFindManyMatcher(context, spec)
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
    placeholder === undefined ||
    placeholder.valueType !== spec.valueType ||
    !matchesSelectDescriptor(root.fields.select, spec.select)
  ) {
    return undefined
  }

  return (args) => matchFindUniqueArgs(args, spec, placeholder.name)
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

function asConstantDescriptorValue(value: unknown, valueType: 'number' | 'string'): number | string | undefined {
  if (!isRecord(value) || value.kind !== 'constant' || typeof value.value !== valueType) {
    return undefined
  }

  return value.value as number | string
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
