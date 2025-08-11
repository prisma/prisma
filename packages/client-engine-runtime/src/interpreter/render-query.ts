import { ArgType, SqlQuery } from '@prisma/driver-adapter-utils'

import type {
  Fragment,
  PlaceholderFormat,
  PrismaValue,
  PrismaValueGenerator,
  PrismaValuePlaceholder,
  QueryPlanDbQuery,
} from '../query-plan'
import {
  isPrismaValueBigInt,
  isPrismaValueBytes,
  isPrismaValueGenerator,
  isPrismaValuePlaceholder,
} from '../query-plan'
import { UserFacingError } from '../user-facing-error'
import { assertNever } from '../utils'
import { GeneratorRegistrySnapshot } from './generators'
import { ScopeBindings } from './scope'

export function renderQuery(
  dbQuery: QueryPlanDbQuery,
  scope: ScopeBindings,
  generators: GeneratorRegistrySnapshot,
  maxChunkSize?: number,
): SqlQuery[] {
  const queryType = dbQuery.type
  const params = evaluateParams(dbQuery.params, scope, generators)

  switch (queryType) {
    case 'rawSql':
      return [renderRawSql(dbQuery.sql, evaluateParams(dbQuery.params, scope, generators))]
    case 'templateSql': {
      const chunks = dbQuery.chunkable ? chunkParams(dbQuery.fragments, params, maxChunkSize) : [params]
      return chunks.map((params) => {
        if (maxChunkSize !== undefined && params.length > maxChunkSize) {
          throw new UserFacingError('The query parameter limit supported by your database is exceeded.', 'P2029')
        }

        return renderTemplateSql(dbQuery.fragments, dbQuery.placeholderFormat, params)
      })
    }
    default:
      assertNever(queryType, `Invalid query type`)
  }
}

function evaluateParams(params: PrismaValue[], scope: ScopeBindings, generators: GeneratorRegistrySnapshot): unknown[] {
  return params.map((param) => evaluateParam(param, scope, generators))
}

export function evaluateParam(
  param: PrismaValue,
  scope: ScopeBindings,
  generators: GeneratorRegistrySnapshot,
): unknown {
  let value: unknown = param

  while (doesRequireEvaluation(value)) {
    if (isPrismaValuePlaceholder(value)) {
      const found = scope[value.prisma__value.name]
      if (found === undefined) {
        throw new Error(`Missing value for query variable ${value.prisma__value.name}`)
      }
      value = found
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
  } else if (isPrismaValueBytes(value)) {
    value = Buffer.from(value.prisma__value, 'base64')
  } else if (isPrismaValueBigInt(value)) {
    value = BigInt(value.prisma__value)
  }

  return value
}

function renderTemplateSql(fragments: Fragment[], placeholderFormat: PlaceholderFormat, params: unknown[]): SqlQuery {
  let sql = ''
  const ctx = { placeholderNumber: 1 }
  const flattenedParams: unknown[] = []
  for (const fragment of pairFragmentsWithParams(fragments, params)) {
    flattenedParams.push(...flattenedFragmentParams(fragment))
    sql += renderFragment(fragment, placeholderFormat, ctx)
  }
  return renderRawSql(sql, flattenedParams)
}

function renderFragment(
  fragment: FragmentWithParams,
  placeholderFormat: PlaceholderFormat,
  ctx: { placeholderNumber: number },
): string {
  const fragmentType = fragment.type
  switch (fragmentType) {
    case 'parameter':
      return formatPlaceholder(placeholderFormat, ctx.placeholderNumber++)

    case 'stringChunk':
      return fragment.chunk

    case 'parameterTuple': {
      const placeholders =
        fragment.value.length == 0
          ? 'NULL'
          : fragment.value.map(() => formatPlaceholder(placeholderFormat, ctx.placeholderNumber++)).join(',')
      return `(${placeholders})`
    }

    case 'parameterTupleList': {
      return fragment.value
        .map((tuple) => {
          const elements = tuple
            .map(() => formatPlaceholder(placeholderFormat, ctx.placeholderNumber++))
            .join(fragment.itemSeparator)
          return `${fragment.itemPrefix}${elements}${fragment.itemSuffix}`
        })
        .join(fragment.groupSeparator)
    }

    default:
      assertNever(fragmentType, 'Invalid fragment type')
  }
}

function formatPlaceholder(placeholderFormat: PlaceholderFormat, placeholderNumber: number): string {
  return placeholderFormat.hasNumbering ? `${placeholderFormat.prefix}${placeholderNumber}` : placeholderFormat.prefix
}

function renderRawSql(sql: string, params: unknown[]): SqlQuery {
  const argTypes = params.map((param) => toArgType(param))

  return {
    sql,
    args: params,
    argTypes,
  }
}

function toArgType(value: unknown): ArgType {
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

  if (Buffer.isBuffer(value)) {
    return 'Bytes'
  }

  return 'Unknown'
}

function doesRequireEvaluation(param: unknown): param is PrismaValuePlaceholder | PrismaValueGenerator {
  return isPrismaValuePlaceholder(param) || isPrismaValueGenerator(param)
}

type FragmentWithParams = Fragment &
  (
    | { type: 'stringChunk' }
    | { type: 'parameter'; value: unknown }
    | { type: 'parameterTuple'; value: unknown[] }
    | { type: 'parameterTupleList'; value: unknown[][] }
  )

function* pairFragmentsWithParams(fragments: Fragment[], params: unknown[]): Generator<FragmentWithParams> {
  let index = 0

  for (const fragment of fragments) {
    switch (fragment.type) {
      case 'parameter': {
        if (index >= params.length) {
          throw new Error(`Malformed query template. Fragments attempt to read over ${params.length} parameters.`)
        }

        yield { ...fragment, value: params[index++] }
        break
      }

      case 'stringChunk': {
        yield fragment
        break
      }

      case 'parameterTuple': {
        if (index >= params.length) {
          throw new Error(`Malformed query template. Fragments attempt to read over ${params.length} parameters.`)
        }

        const value = params[index++]
        yield { ...fragment, value: Array.isArray(value) ? value : [value] }
        break
      }

      case 'parameterTupleList': {
        if (index >= params.length) {
          throw new Error(`Malformed query template. Fragments attempt to read over ${params.length} parameters.`)
        }

        const value = params[index++]
        if (!Array.isArray(value)) {
          throw new Error(`Malformed query template. Tuple list expected.`)
        }
        if (value.length === 0) {
          throw new Error(`Malformed query template. Tuple list cannot be empty.`)
        }
        for (const tuple of value) {
          if (!Array.isArray(tuple)) {
            throw new Error(`Malformed query template. Tuple expected.`)
          }
        }

        yield { ...fragment, value }
        break
      }
    }
  }
}

function* flattenedFragmentParams(fragment: FragmentWithParams): Generator<unknown, undefined, undefined> {
  switch (fragment.type) {
    case 'parameter':
      yield fragment.value
      break
    case 'stringChunk':
      break
    case 'parameterTuple':
      yield* fragment.value
      break
    case 'parameterTupleList':
      for (const tuple of fragment.value) {
        yield* tuple
      }
      break
  }
}

function chunkParams(fragments: Fragment[], params: unknown[], maxChunkSize?: number): unknown[][] {
  // Find out the total number of parameters once flattened and what the maximum number of
  // parameters in a single fragment is.
  let totalParamCount = 0
  let maxParamsPerFragment = 0
  for (const fragment of pairFragmentsWithParams(fragments, params)) {
    let paramSize = 0
    for (const _ of flattenedFragmentParams(fragment)) {
      void _
      paramSize++
    }
    maxParamsPerFragment = Math.max(maxParamsPerFragment, paramSize)
    totalParamCount += paramSize
  }

  let chunkedParams: unknown[][] = [[]]
  for (const fragment of pairFragmentsWithParams(fragments, params)) {
    switch (fragment.type) {
      case 'parameter': {
        for (const params of chunkedParams) {
          params.push(fragment.value)
        }
        break
      }

      case 'stringChunk': {
        break
      }

      case 'parameterTuple': {
        const thisParamCount = fragment.value.length
        let chunks: unknown[][] = []

        if (
          maxChunkSize &&
          // Have we split the parameters into chunks already?
          chunkedParams.length === 1 &&
          // Is this the fragment that has the most parameters?
          thisParamCount === maxParamsPerFragment &&
          // Do we need chunking to fit the parameters?
          totalParamCount > maxChunkSize &&
          // Would chunking enable us to fit the parameters?
          totalParamCount - thisParamCount < maxChunkSize
        ) {
          const availableSize = maxChunkSize - (totalParamCount - thisParamCount)
          chunks = chunkArray(fragment.value, availableSize)
        } else {
          chunks = [fragment.value]
        }

        chunkedParams = chunkedParams.flatMap((params) => chunks.map((chunk) => [...params, chunk]))
        break
      }

      case 'parameterTupleList': {
        const thisParamCount = fragment.value.reduce((acc, tuple) => acc + tuple.length, 0)

        const completeChunks: unknown[][][] = []
        let currentChunk: unknown[][] = []
        let currentChunkParamCount = 0

        for (const tuple of fragment.value) {
          if (
            maxChunkSize &&
            // Have we split the parameters into chunks already?
            chunkedParams.length === 1 &&
            // Is this the fragment that has the most parameters?
            thisParamCount === maxParamsPerFragment &&
            // Is there anything in the current chunk?
            currentChunk.length > 0 &&
            // Will adding this tuple exceed the max chunk size?
            totalParamCount - thisParamCount + currentChunkParamCount + tuple.length > maxChunkSize
          ) {
            completeChunks.push(currentChunk)
            currentChunk = []
            currentChunkParamCount = 0
          }
          currentChunk.push(tuple)
          currentChunkParamCount += tuple.length
        }

        if (currentChunk.length > 0) {
          completeChunks.push(currentChunk)
        }

        chunkedParams = chunkedParams.flatMap((params) => completeChunks.map((chunk) => [...params, chunk]))
        break
      }
    }
  }

  return chunkedParams
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize))
  }
  return result
}
