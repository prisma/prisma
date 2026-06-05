import { ArgType, SqlQuery } from '@prisma/driver-adapter-utils'

import {
  DynamicArgType,
  type Fragment,
  isPrismaValueGenerator,
  isPrismaValuePlaceholder,
  type PlaceholderFormat,
  type PrismaValueGenerator,
  type PrismaValuePlaceholder,
  type QueryPlanDbQuery,
} from '../query-plan'
import { UserFacingError } from '../user-facing-error'
import { assertNever, DeepReadonly } from '../utils'
import { GeneratorRegistrySnapshot } from './generators'
import { ScopeBindings } from './scope'

const EMPTY_ARGS = Object.freeze([]) as unknown as unknown[]
const EMPTY_ARG_TYPES = Object.freeze([]) as unknown as ArgType[]

type FlatTemplateSqlRendering = {
  sql: string
  paramCount: number
  argTypes: ArgType[]
}

const flatTemplateSqlCache = new WeakMap<DeepReadonly<QueryPlanDbQuery>, FlatTemplateSqlRendering | null>()

export function renderQuery(
  dbQuery: DeepReadonly<QueryPlanDbQuery>,
  scope: ScopeBindings,
  generators: GeneratorRegistrySnapshot,
  maxChunkSize?: number,
): DeepReadonly<SqlQuery>[] {
  if (dbQuery.type === 'templateSql' && dbQuery.args.length === 0) {
    const fragment = dbQuery.fragments.length === 1 ? dbQuery.fragments[0] : undefined
    if (fragment?.type === 'stringChunk') {
      return [
        {
          sql: fragment.chunk,
          args: EMPTY_ARGS,
          argTypes: EMPTY_ARG_TYPES,
        },
      ]
    }
  }

  switch (dbQuery.type) {
    case 'rawSql': {
      const args = evaluateArgs(dbQuery.args, scope, generators)
      return [renderRawSql(dbQuery.sql, args, dbQuery.argTypes)]
    }

    case 'templateSql': {
      const flatRendering = getFlatTemplateSqlRendering(dbQuery)
      if (flatRendering !== undefined) {
        if (maxChunkSize !== undefined && flatRendering.paramCount > maxChunkSize) {
          throw new UserFacingError('The query parameter limit supported by your database is exceeded.', 'P2029')
        }

        if (flatRendering.paramCount === 0) {
          return [
            {
              sql: flatRendering.sql,
              args: EMPTY_ARGS,
              argTypes: EMPTY_ARG_TYPES,
            },
          ]
        }

        const args = evaluateArgs(dbQuery.args, scope, generators)
        if (flatRendering.paramCount > args.length) {
          throw new Error(`Malformed query template. Fragments attempt to read over ${args.length} parameters.`)
        }
        const queryArgs = flatRendering.paramCount === args.length ? args : args.slice(0, flatRendering.paramCount)

        return [
          {
            sql: flatRendering.sql,
            args: queryArgs,
            argTypes: flatRendering.argTypes,
          },
        ]
      }

      const args = evaluateArgs(dbQuery.args, scope, generators)
      const chunks = dbQuery.chunkable ? chunkParams(dbQuery.fragments, args, maxChunkSize) : [args]
      return chunks.map((params) => {
        const rendered = renderTemplateSql(dbQuery.fragments, dbQuery.placeholderFormat, params, dbQuery.argTypes)
        if (maxChunkSize !== undefined && rendered.args.length > maxChunkSize) {
          throw new UserFacingError('The query parameter limit supported by your database is exceeded.', 'P2029')
        }
        return rendered
      })
    }

    default:
      assertNever(dbQuery['type'], `Invalid query type`)
  }
}

function getFlatTemplateSqlRendering(dbQuery: DeepReadonly<QueryPlanDbQuery>): FlatTemplateSqlRendering | undefined {
  const cached = flatTemplateSqlCache.get(dbQuery)
  if (cached !== undefined) {
    return cached ?? undefined
  }

  if (dbQuery.type !== 'templateSql') {
    flatTemplateSqlCache.set(dbQuery, null)
    return undefined
  }

  let sql = ''
  let placeholderNumber = 1
  let paramCount = 0

  for (const fragment of dbQuery.fragments) {
    switch (fragment.type) {
      case 'stringChunk':
        sql += fragment.chunk
        break

      case 'parameter':
        sql += formatPlaceholder(dbQuery.placeholderFormat, placeholderNumber++)
        paramCount++
        break

      case 'parameterTuple':
      case 'parameterTupleList':
        flatTemplateSqlCache.set(dbQuery, null)
        return undefined

      default:
        assertNever(fragment, 'Invalid fragment type')
    }
  }

  const rendering: FlatTemplateSqlRendering = {
    sql,
    paramCount,
    argTypes:
      paramCount === dbQuery.argTypes.length
        ? (dbQuery.argTypes as ArgType[])
        : copyArgTypes(dbQuery.argTypes, paramCount),
  }
  flatTemplateSqlCache.set(dbQuery, rendering)
  return rendering
}

function evaluateArgs(
  args: readonly unknown[],
  scope: ScopeBindings,
  generators: GeneratorRegistrySnapshot,
): unknown[] {
  const result = new Array<unknown>(args.length)

  for (let i = 0; i < args.length; i++) {
    result[i] = evaluateArg(args[i], scope, generators)
  }

  return result
}

export function evaluateArg(arg: unknown, scope: ScopeBindings, generators: GeneratorRegistrySnapshot): unknown {
  while (doesRequireEvaluation(arg)) {
    if (isPrismaValuePlaceholder(arg)) {
      const found = scope[arg.prisma__value.name]
      if (found === undefined) {
        throw new Error(`Missing value for query variable ${arg.prisma__value.name}`)
      }
      if (arg.prisma__value.type === 'DateTime' && typeof found === 'string') {
        // Convert input datetime strings to Date objects. This is done to prevent issues that
        // arise when query input values end up being directly compared to values retrieved from
        // the database. One example of this is a query containing a DateTime cursor value being
        // used against a DATE MySQL column. The pagination logic doesn't have parameter type
        // information, therefore it ends up comparing the two datetimes as strings and would yield
        // false even if the two date datetime strings represent the same Date.
        arg = new Date(found)
      } else {
        arg = found
      }
    } else if (isPrismaValueGenerator(arg)) {
      const { name, args } = arg.prisma__value
      const generator = generators[name]
      if (!generator) {
        throw new Error(`Encountered an unknown generator '${name}'`)
      }
      arg = generator.generate(...args.map((arg) => evaluateArg(arg, scope, generators)))
    } else {
      assertNever(arg, `Unexpected unevaluated value type: ${arg}`)
    }
  }

  if (Array.isArray(arg)) {
    arg = arg.map((el) => evaluateArg(el, scope, generators))
  }

  return arg
}

function copyArgTypes(argTypes: DeepReadonly<DynamicArgType[]>, length: number): ArgType[] {
  const result = new Array<ArgType>(length)
  for (let i = 0; i < length; i++) {
    result[i] = argTypes[i] as ArgType
  }
  return result
}

function renderTemplateSql(
  fragments: DeepReadonly<Fragment[]>,
  placeholderFormat: PlaceholderFormat,
  params: unknown[],
  argTypes: DeepReadonly<DynamicArgType[]>,
): SqlQuery {
  let sql = ''
  const ctx = { placeholderNumber: 1 }
  const flattenedParams: unknown[] = []
  const flattenedArgTypes: ArgType[] = []

  for (const fragment of pairFragmentsWithParams(fragments, params, argTypes)) {
    sql += renderFragment(fragment, placeholderFormat, ctx)
    if (fragment.type === 'stringChunk') {
      continue
    }
    const length = flattenedParams.length
    const added = flattenedParams.push(...flattenedFragmentParams(fragment)) - length

    if (fragment.argType.arity === 'tuple') {
      if (added % fragment.argType.elements.length !== 0) {
        throw new Error(
          `Malformed query template. Expected the number of parameters to match the tuple arity, but got ${added} parameters for a tuple of arity ${fragment.argType.elements.length}.`,
        )
      }
      // If we have a tuple, we just expand its elements repeatedly.
      for (let i = 0; i < added / fragment.argType.elements.length; i++) {
        flattenedArgTypes.push(...fragment.argType.elements)
      }
    } else {
      // If we have a non-tuple, we just expand the single type repeatedly.
      for (let i = 0; i < added; i++) {
        flattenedArgTypes.push(fragment.argType)
      }
    }
  }

  return {
    sql,
    args: flattenedParams,
    argTypes: flattenedArgTypes,
  }
}

function renderFragment<Type extends DeepReadonly<DynamicArgType> | undefined>(
  fragment: FragmentWithParams<Type>,
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
      let placeholders = ''
      if (fragment.value.length === 0) {
        placeholders = 'NULL'
      } else {
        for (let i = 0; i < fragment.value.length; i++) {
          if (i > 0) {
            placeholders += fragment.itemSeparator
          }
          placeholders += fragment.itemPrefix
          placeholders += formatPlaceholder(placeholderFormat, ctx.placeholderNumber++)
          placeholders += fragment.itemSuffix
        }
      }
      return `(${placeholders})`
    }

    case 'parameterTupleList': {
      let result = ''
      for (let tupleIndex = 0; tupleIndex < fragment.value.length; tupleIndex++) {
        if (tupleIndex > 0) {
          result += fragment.groupSeparator
        }

        const tuple = fragment.value[tupleIndex]
        result += fragment.itemPrefix
        for (let itemIndex = 0; itemIndex < tuple.length; itemIndex++) {
          if (itemIndex > 0) {
            result += fragment.itemSeparator
          }
          result += formatPlaceholder(placeholderFormat, ctx.placeholderNumber++)
        }
        result += fragment.itemSuffix
      }
      return result
    }

    default:
      assertNever(fragmentType, 'Invalid fragment type')
  }
}

function formatPlaceholder(placeholderFormat: PlaceholderFormat, placeholderNumber: number): string {
  return placeholderFormat.hasNumbering ? `${placeholderFormat.prefix}${placeholderNumber}` : placeholderFormat.prefix
}

function renderRawSql(sql: string, params: unknown[], argTypes: DeepReadonly<DynamicArgType[]>): SqlQuery {
  return {
    sql,
    args: params,
    argTypes: argTypes as ArgType[],
  }
}

function doesRequireEvaluation(param: unknown): param is PrismaValuePlaceholder | PrismaValueGenerator {
  return isPrismaValuePlaceholder(param) || isPrismaValueGenerator(param)
}

type FragmentWithParams<Type extends DeepReadonly<DynamicArgType> | undefined = undefined> = Fragment &
  (
    | { type: 'stringChunk' }
    | { type: 'parameter'; value: unknown; argType: Type }
    | { type: 'parameterTuple'; value: unknown[]; argType: Type }
    | { type: 'parameterTupleList'; value: unknown[][]; argType: Type }
  )

function* pairFragmentsWithParams<Types>(
  fragments: DeepReadonly<Fragment[]>,
  params: unknown[],
  argTypes: Types,
): Generator<
  FragmentWithParams<Types extends DeepReadonly<DynamicArgType[]> ? DeepReadonly<DynamicArgType> : undefined>
> {
  let index = 0

  for (const fragment of fragments) {
    switch (fragment.type) {
      case 'parameter': {
        if (index >= params.length) {
          throw new Error(`Malformed query template. Fragments attempt to read over ${params.length} parameters.`)
        }

        yield { ...fragment, value: params[index], argType: argTypes?.[index] }
        index++
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

        const value = params[index]
        yield { ...fragment, value: Array.isArray(value) ? value : [value], argType: argTypes?.[index] }
        index++
        break
      }

      case 'parameterTupleList': {
        if (index >= params.length) {
          throw new Error(`Malformed query template. Fragments attempt to read over ${params.length} parameters.`)
        }

        const value = params[index]
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

        yield { ...fragment, value, argType: argTypes?.[index] }
        index++
        break
      }
    }
  }
}

function* flattenedFragmentParams<Type extends DeepReadonly<DynamicArgType> | undefined>(
  fragment: FragmentWithParams<Type>,
): Generator<unknown, undefined, undefined> {
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

function chunkParams(fragments: DeepReadonly<Fragment[]>, params: unknown[], maxChunkSize?: number): unknown[][] {
  // Find out the total number of parameters once flattened and what the maximum number of
  // parameters in a single fragment is.
  let totalParamCount = 0
  let maxParamsPerFragment = 0
  for (const fragment of pairFragmentsWithParams(fragments, params, undefined)) {
    let paramSize = 0
    for (const _ of flattenedFragmentParams(fragment)) {
      void _
      paramSize++
    }
    maxParamsPerFragment = Math.max(maxParamsPerFragment, paramSize)
    totalParamCount += paramSize
  }

  let chunkedParams: unknown[][] = [[]]
  for (const fragment of pairFragmentsWithParams(fragments, params, undefined)) {
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
