import type { PrismaValue } from '@prisma/client-engine-runtime'
import type { ArgScalarType, ArgType } from '@prisma/driver-adapter-utils'

type RawParameters = {
  args: PrismaValue[]
  argTypes: ArgType[]
}

const tagToArgScalarType: Record<string, ArgScalarType> = {
  bigint: 'bigint',
  date: 'datetime',
  decimal: 'decimal',
  bytes: 'bytes',
}

export function deserializeRawParameters(serializedParameters: string): RawParameters {
  const parsed = JSON.parse(serializedParameters)
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid serialized parameters')
  }
  const args = parsed.map((parameter: unknown) => decodeParameter(parameter))
  const argTypes = parsed.map((parameter: unknown) => getArgType(parameter))
  return { args, argTypes }
}

function decodeParameter(parameter: unknown): PrismaValue {
  if (Array.isArray(parameter)) {
    return parameter.map((item) => decodeParameter(item))
  }

  if (
    typeof parameter === 'object' &&
    parameter !== null &&
    'prisma__type' in parameter &&
    'prisma__value' in parameter
  ) {
    return `${parameter.prisma__value}`
  }

  if (typeof parameter === 'object' && parameter !== null) {
    return JSON.stringify(parameter)
  }

  return parameter as PrismaValue
}

function getArgType(parameter: unknown): ArgType {
  if (Array.isArray(parameter)) {
    return { scalarType: parameter.length > 0 ? getScalarType(parameter[0]) : 'unknown', arity: 'list' }
  }

  return { scalarType: getScalarType(parameter), arity: 'scalar' }
}

function getScalarType(parameter: unknown): ArgScalarType {
  if (
    typeof parameter === 'object' &&
    parameter !== null &&
    'prisma__type' in parameter &&
    typeof parameter.prisma__type === 'string' &&
    parameter.prisma__type in tagToArgScalarType
  ) {
    return tagToArgScalarType[parameter.prisma__type]
  }

  if (typeof parameter === 'number') {
    return 'decimal'
  }

  if (typeof parameter === 'string') {
    return 'string'
  }

  return 'unknown'
}
