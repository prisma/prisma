import type { ArgType, SqlQuery } from '@prisma/driver-adapter-utils'

import { isPrismaValuePlaceholder, type PrismaValue, type QueryPlanDbQuery } from '../QueryPlan'
import { renderQueryTemplate } from './renderQueryTemplate'
import type { ScopeBindings } from './scope'

export function renderQuery({ query, params }: QueryPlanDbQuery, scope: ScopeBindings): SqlQuery {
  const substitutedParams = params.map((param) => {
    if (!isPrismaValuePlaceholder(param)) {
      return param
    }

    const value = scope[param.prisma__value.name]
    if (value === undefined) {
      throw new Error(`Missing value for query variable ${param.prisma__value.name}`)
    }

    return value
  })

  const { query: renderedQuery, params: expandedParams } = renderQueryTemplate({ query, params: substitutedParams })

  const argTypes = expandedParams.map((param) => toArgType(param as PrismaValue))

  return {
    sql: renderedQuery,
    args: expandedParams,
    argTypes,
  }
}

function toArgType(value: PrismaValue): ArgType {
  if (value === null) {
    // TODO: either introduce Unknown or Null type in driver adapters,
    // or change PrismaValue to be able to represent typed nulls.
    return 'Int32'
  }

  if (typeof value === 'string') {
    return 'Text'
  }

  if (typeof value === 'number') {
    return 'Numeric'
  }

  if (typeof value === 'boolean') {
    return 'Boolean'
  }

  if (Array.isArray(value)) {
    return 'Array'
  }

  if (isPrismaValuePlaceholder(value)) {
    return placeholderTypeToArgType(value.prisma__value.type)
  }

  return 'Json'
}

function placeholderTypeToArgType(type: string): ArgType {
  const typeMap = {
    Any: 'Json',
    String: 'Text',
    Int: 'Int32',
    BigInt: 'Int64',
    Float: 'Double',
    Boolean: 'Boolean',
    Decimal: 'Numeric',
    Date: 'DateTime',
    Object: 'Json',
    Bytes: 'Bytes',
    Array: 'Array',
  } satisfies Record<string, ArgType>

  const mappedType = typeMap[type] as ArgType | undefined

  if (!mappedType) {
    throw new Error(`Unknown placeholder type: ${type}`)
  }

  return mappedType
}
