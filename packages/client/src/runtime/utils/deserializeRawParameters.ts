import type { PrismaValue, QueryPlanArgScalarType, QueryPlanArgType } from '@prisma/client-engine-runtime'
import type { ArgScalarType } from '@prisma/driver-adapter-utils'

type RawParameters = {
  args: PrismaValue[]
  argTypes: QueryPlanArgType[]
}

const tagToArgScalarType: Record<string, ArgScalarType> = {
  bigint: 'bigint',
  date: 'datetime',
  decimal: 'decimal',
  bytes: 'bytes',
}

const scalarTypeToQueryPlanArgType = {
  string: 's',
  int: 'i',
  bigint: 'I',
  float: 'f',
  decimal: 'd',
  boolean: 'b',
  enum: 'e',
  uuid: 'u',
  json: 'j',
  datetime: 'D',
  bytes: 'B',
  unknown: '?',
} satisfies Record<ArgScalarType, QueryPlanArgScalarType>

export function deserializeRawParameters(serializedParameters: string): RawParameters {
  let parsed: unknown
  try {
    parsed = JSON.parse(serializedParameters)
  } catch (err) {
    throw new Error(`Received invalid serialized parameters: ${err.message}`)
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Received invalid serialized parameters: expected an array')
  }
  const args = parsed.map((parameter: unknown) => decodeParameter(parameter))
  const argTypes = parsed.map((parameter: unknown) => getArgType(parameter))
  return { args, argTypes }
}

function decodeParameter(parameter: unknown): PrismaValue {
  if (Array.isArray(parameter)) {
    return parameter.map((item) => decodeParameter(item))
  }

  if (typeof parameter === 'object' && parameter !== null && 'prisma__value' in parameter) {
    if (!('prisma__type' in parameter)) {
      throw new Error('Invalid serialized parameter, prisma__type should be present when prisma__value is present')
    }
    return `${parameter.prisma__value}`
  }

  if (typeof parameter === 'object' && parameter !== null) {
    return JSON.stringify(parameter)
  }

  return parameter as PrismaValue
}

function getArgType(parameter: unknown): QueryPlanArgType {
  if (Array.isArray(parameter)) {
    return { scalarType: parameter.length > 0 ? getScalarType(parameter[0]) : 'unknown', arity: 'list' }
  }

  return scalarTypeToQueryPlanArgType[getScalarType(parameter)]
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
