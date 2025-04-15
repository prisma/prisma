import { ArgType, SqlQuery } from '@prisma/driver-adapter-utils'

import type {
  Fragment,
  PlaceholderFormat,
  PrismaValue,
  PrismaValueGenerator,
  PrismaValuePlaceholder,
  QueryPlanDbQuery,
} from '../QueryPlan'
import { isPrismaValueGenerator, isPrismaValuePlaceholder } from '../QueryPlan'
import { assertNever } from '../utils'
import { GeneratorRegistrySnapshot } from './generators'
import { ScopeBindings } from './scope'

export function renderQuery(
  dbQuery: QueryPlanDbQuery,
  scope: ScopeBindings,
  generators: GeneratorRegistrySnapshot,
): SqlQuery {
  const queryType = dbQuery.type
  switch (queryType) {
    case 'rawSql':
      return renderRawSql(dbQuery.sql, evaluateParams(dbQuery.params, scope, generators))

    case 'templateSql':
      return renderTemplateSql(
        dbQuery.fragments,
        dbQuery.placeholderFormat,
        evaluateParams(dbQuery.params, scope, generators),
      )

    default:
      assertNever(queryType, `Invalid query type`)
  }
}

function evaluateParams(
  params: PrismaValue[],
  scope: ScopeBindings,
  generators: GeneratorRegistrySnapshot,
): PrismaValue[] {
  return params.map((param) => evaluateParam(param, scope, generators))
}

function evaluateParam(param: PrismaValue, scope: ScopeBindings, generators: GeneratorRegistrySnapshot): PrismaValue {
  let value = param

  while (doesRequireEvaluation(value)) {
    if (isPrismaValuePlaceholder(value)) {
      const found = scope[value.prisma__value.name]
      if (found === undefined) {
        throw new Error(`Missing value for query variable ${value.prisma__value.name}`)
      }
      value = found as PrismaValue
    } else if (isPrismaValueGenerator(value)) {
      const { name, args } = value.prisma__value
      const generator = generators[name]
      if (!generator) {
        throw new Error(`Encountered an unknown generator '${name}'`)
      }
      value = generator.generate(...args.map((arg) => evaluateParam(arg, scope, generators)))
    } else {
      assertNever(value, `Unexpected unevaluated value type: ${value}`)
    }
  }

  if (Array.isArray(value)) {
    value = value.map((el) => evaluateParam(el, scope, generators))
  }

  return value
}

function renderTemplateSql(
  fragments: Fragment[],
  placeholderFormat: PlaceholderFormat,
  params: PrismaValue[],
): SqlQuery {
  let paramIndex = 0
  let placeholderNumber = 1
  const flattenedParams: PrismaValue[] = []
  const sql = fragments
    .map((fragment) => {
      const fragmentType = fragment.type
      switch (fragmentType) {
        case 'parameter':
          if (paramIndex >= params.length) {
            throw new Error(`Malformed query template. Fragments attempt to read over ${params.length} parameters.`)
          }
          flattenedParams.push(params[paramIndex++])
          return formatPlaceholder(placeholderFormat, placeholderNumber++)

        case 'stringChunk':
          return fragment.value

        case 'parameterTuple': {
          if (paramIndex >= params.length) {
            throw new Error(`Malformed query template. Fragments attempt to read over ${params.length} parameters.`)
          }
          const paramValue = params[paramIndex++]
          const paramArray = Array.isArray(paramValue) ? paramValue : [paramValue]
          const placeholders =
            paramArray.length == 0
              ? 'NULL'
              : paramArray
                  .map((value) => {
                    flattenedParams.push(value)
                    return formatPlaceholder(placeholderFormat, placeholderNumber++)
                  })
                  .join(',')
          return `(${placeholders})`
        }

        case 'parameterTupleList': {
          if (paramIndex >= params.length) {
            throw new Error(`Malformed query template. Fragments attempt to read over ${params.length} parameters.`)
          }
          const paramValue = params[paramIndex++]

          if (!Array.isArray(paramValue)) {
            throw new Error(`Malformed query template. Tuple list expected.`)
          }

          if (paramValue.length === 0) {
            throw new Error(`Malformed query template. Tuple list cannot be empty.`)
          }

          const tupleList = paramValue
            .map((tuple) => {
              if (!Array.isArray(tuple)) {
                throw new Error(`Malformed query template. Tuple expected.`)
              }
              const elements = tuple
                .map((value) => {
                  flattenedParams.push(value)
                  return formatPlaceholder(placeholderFormat, placeholderNumber++)
                })
                .join(',')
              return `(${elements})`
            })
            .join(',')
          return tupleList
        }

        default:
          assertNever(fragmentType, 'Invalid fragment type')
      }
    })
    .join('')

  return renderRawSql(sql, flattenedParams)
}

function formatPlaceholder(placeholderFormat: PlaceholderFormat, placeholderNumber: number): string {
  return placeholderFormat.hasNumbering ? `${placeholderFormat.prefix}${placeholderNumber}` : placeholderFormat.prefix
}

function renderRawSql(sql: string, params: PrismaValue[]): SqlQuery {
  const argTypes = params.map((param) => toArgType(param))

  return {
    sql,
    args: params,
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

function doesRequireEvaluation(param: PrismaValue): param is PrismaValuePlaceholder | PrismaValueGenerator {
  return isPrismaValuePlaceholder(param) || isPrismaValueGenerator(param)
}
