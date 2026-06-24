import type { ArgScalarType, ArgType, SqlQuery } from '@prisma/driver-adapter-utils'

import {
  type CompactParameterTupleFragment,
  type CompactParameterTupleListFragment,
  type DynamicArgType,
  type Fragment,
  getPrismaValuePlaceholderName,
  getPrismaValuePlaceholderType,
  isPrismaValueGenerator,
  isPrismaValuePlaceholder,
  type PrismaValueGenerator,
  type PrismaValuePlaceholder,
  type QueryPlanArgType,
  type QueryPlanCompactTemplateSql,
  type QueryPlanDbQuery,
  type QueryPlanRawSql,
  type QueryPlanTemplateSql,
} from '../query-plan'
import { UserFacingError } from '../user-facing-error'
import { assertNever, DeepReadonly } from '../utils'
import { GeneratorRegistrySnapshot } from './generators'
import { ScopeBindings } from './scope'

const EMPTY_ARGS = Object.freeze([]) as unknown as unknown[]
const EMPTY_ARG_TYPES = Object.freeze([]) as unknown as ArgType[]
const SCALAR_ARG_TYPES: Record<ArgScalarType, ArgType> = Object.freeze({
  string: Object.freeze({ arity: 'scalar', scalarType: 'string' }),
  int: Object.freeze({ arity: 'scalar', scalarType: 'int' }),
  bigint: Object.freeze({ arity: 'scalar', scalarType: 'bigint' }),
  float: Object.freeze({ arity: 'scalar', scalarType: 'float' }),
  decimal: Object.freeze({ arity: 'scalar', scalarType: 'decimal' }),
  boolean: Object.freeze({ arity: 'scalar', scalarType: 'boolean' }),
  enum: Object.freeze({ arity: 'scalar', scalarType: 'enum' }),
  uuid: Object.freeze({ arity: 'scalar', scalarType: 'uuid' }),
  json: Object.freeze({ arity: 'scalar', scalarType: 'json' }),
  datetime: Object.freeze({ arity: 'scalar', scalarType: 'datetime' }),
  bytes: Object.freeze({ arity: 'scalar', scalarType: 'bytes' }),
  unknown: Object.freeze({ arity: 'scalar', scalarType: 'unknown' }),
})

type TemplateSqlQuery = QueryPlanTemplateSql
type CompactTemplateSqlQuery = QueryPlanCompactTemplateSql
type CompactTupleFragment = CompactParameterTupleFragment | CompactParameterTupleListFragment
type LegacyTupleFragment = Extract<Fragment, { type: 'parameterTuple' | 'parameterTupleList' }>
type TupleFragment = CompactTupleFragment | LegacyTupleFragment

type FlatTemplateSqlRendering = {
  sql: string
  paramCount: number
  argTypes: ArgType[]
}

const flatTemplateSqlCache = new WeakMap<object, FlatTemplateSqlRendering | null>()

export function renderQuery(
  dbQuery: DeepReadonly<QueryPlanDbQuery>,
  scope: ScopeBindings,
  generators: GeneratorRegistrySnapshot,
  maxChunkSize?: number,
): DeepReadonly<SqlQuery>[] {
  const rawQuery = dbQuery as DeepReadonly<QueryPlanRawSql>
  if (rawQuery.type === 'rawSql') {
    const args = evaluateArgs(rawQuery.args, scope, generators)
    return [renderRawSql(rawQuery.sql, args, rawQuery.argTypes)]
  }

  if (Array.isArray(dbQuery)) {
    return renderCompactTemplateSqlQuery(
      dbQuery as DeepReadonly<CompactTemplateSqlQuery>,
      scope,
      generators,
      maxChunkSize,
    )
  }

  return renderLegacyTemplateSqlQuery(dbQuery as DeepReadonly<TemplateSqlQuery>, scope, generators, maxChunkSize)
}

function renderLegacyTemplateSqlQuery(
  dbQuery: DeepReadonly<TemplateSqlQuery>,
  scope: ScopeBindings,
  generators: GeneratorRegistrySnapshot,
  maxChunkSize?: number,
): DeepReadonly<SqlQuery>[] {
  if (dbQuery.args.length === 0) {
    const fragment = dbQuery.fragments.length === 1 ? dbQuery.fragments[0] : undefined
    if (typeof fragment === 'string') {
      return [
        {
          sql: fragment,
          args: EMPTY_ARGS,
          argTypes: EMPTY_ARG_TYPES,
        },
      ]
    }
    if (fragment && !isCompactTupleFragment(fragment) && fragment.type === 'stringChunk') {
      return [
        {
          sql: fragment.chunk,
          args: EMPTY_ARGS,
          argTypes: EMPTY_ARG_TYPES,
        },
      ]
    }
  }

  const placeholderFormat = dbQuery.placeholderFormat
  const flatRendering = getFlatTemplateSqlRenderingFromParts(
    dbQuery,
    dbQuery.fragments,
    placeholderFormat.prefix,
    placeholderFormat.hasNumbering,
    dbQuery.argTypes,
  )
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
    const renderedArgs = flatRendering.paramCount === args.length ? args : args.slice(0, flatRendering.paramCount)

    return [
      {
        sql: flatRendering.sql,
        args: renderedArgs,
        argTypes: flatRendering.argTypes,
      },
    ]
  }

  const args = evaluateArgs(dbQuery.args, scope, generators)
  const chunks = dbQuery.chunkable ? chunkParams(dbQuery.fragments, args, maxChunkSize) : [args]
  const result = new Array<DeepReadonly<SqlQuery>>(chunks.length)
  for (let i = 0; i < chunks.length; i++) {
    const rendered = renderTemplateSql(
      dbQuery.fragments,
      placeholderFormat.prefix,
      placeholderFormat.hasNumbering,
      chunks[i],
      dbQuery.argTypes,
    )
    if (maxChunkSize !== undefined && rendered.args.length > maxChunkSize) {
      throw new UserFacingError('The query parameter limit supported by your database is exceeded.', 'P2029')
    }
    result[i] = rendered
  }
  return result
}

function renderCompactTemplateSqlQuery(
  dbQuery: DeepReadonly<CompactTemplateSqlQuery>,
  scope: ScopeBindings,
  generators: GeneratorRegistrySnapshot,
  maxChunkSize?: number,
): DeepReadonly<SqlQuery>[] {
  const fragments = dbQuery[0]
  const placeholderFormat = dbQuery[1]
  const queryArgs = dbQuery[2]
  const argTypes = dbQuery[3]
  const chunkable = dbQuery[4]
  const placeholderPrefix = placeholderFormat[0]
  const placeholderHasNumbering = placeholderFormat[1]

  if (queryArgs.length === 0) {
    const fragment = fragments.length === 1 ? fragments[0] : undefined
    if (typeof fragment === 'string') {
      return [
        {
          sql: fragment,
          args: EMPTY_ARGS,
          argTypes: EMPTY_ARG_TYPES,
        },
      ]
    }
    if (fragment && !isCompactTupleFragment(fragment) && fragment.type === 'stringChunk') {
      return [
        {
          sql: fragment.chunk,
          args: EMPTY_ARGS,
          argTypes: EMPTY_ARG_TYPES,
        },
      ]
    }
  }

  const flatRendering = getFlatTemplateSqlRenderingFromParts(
    dbQuery,
    fragments,
    placeholderPrefix,
    placeholderHasNumbering,
    argTypes,
  )
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

    const args = evaluateArgs(queryArgs, scope, generators)
    if (flatRendering.paramCount > args.length) {
      throw new Error(`Malformed query template. Fragments attempt to read over ${args.length} parameters.`)
    }
    const renderedArgs = flatRendering.paramCount === args.length ? args : args.slice(0, flatRendering.paramCount)

    return [
      {
        sql: flatRendering.sql,
        args: renderedArgs,
        argTypes: flatRendering.argTypes,
      },
    ]
  }

  const args = evaluateArgs(queryArgs, scope, generators)
  const chunks = chunkable ? chunkParams(fragments, args, maxChunkSize) : [args]
  const result = new Array<DeepReadonly<SqlQuery>>(chunks.length)
  for (let i = 0; i < chunks.length; i++) {
    const rendered = renderTemplateSql(fragments, placeholderPrefix, placeholderHasNumbering, chunks[i], argTypes)
    if (maxChunkSize !== undefined && rendered.args.length > maxChunkSize) {
      throw new UserFacingError('The query parameter limit supported by your database is exceeded.', 'P2029')
    }
    result[i] = rendered
  }
  return result
}

function getFlatTemplateSqlRenderingFromParts(
  cacheKey: object,
  fragments: DeepReadonly<Fragment[]>,
  placeholderPrefix: string,
  placeholderHasNumbering: boolean,
  argTypes: DeepReadonly<DynamicArgType[]>,
): FlatTemplateSqlRendering | undefined {
  const cached = flatTemplateSqlCache.get(cacheKey)
  if (cached !== undefined) {
    return cached ?? undefined
  }

  let sql = ''
  let placeholderNumber = 1
  let paramCount = 0

  for (const fragment of fragments) {
    if (typeof fragment === 'string') {
      sql += fragment
      continue
    }

    if (fragment === null) {
      if (placeholderHasNumbering) {
        sql += `${placeholderPrefix}${placeholderNumber++}`
      } else {
        sql += placeholderPrefix
      }
      paramCount++
      continue
    }

    if (isCompactTupleFragment(fragment)) {
      flatTemplateSqlCache.set(cacheKey, null)
      return undefined
    }

    switch (fragment.type) {
      case 'stringChunk':
        sql += fragment.chunk
        break

      case 'parameter':
        if (placeholderHasNumbering) {
          sql += `${placeholderPrefix}${placeholderNumber++}`
        } else {
          sql += placeholderPrefix
        }
        paramCount++
        break

      case 'parameterTuple':
      case 'parameterTupleList':
        flatTemplateSqlCache.set(cacheKey, null)
        return undefined

      default:
        assertNever(fragment, 'Invalid fragment type')
    }
  }

  const rendering: FlatTemplateSqlRendering = {
    sql,
    paramCount,
    argTypes: copyArgTypes(argTypes, paramCount),
  }
  flatTemplateSqlCache.set(cacheKey, rendering)
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
      const placeholderName = getPrismaValuePlaceholderName(arg)
      const found = scope[placeholderName]
      if (found === undefined) {
        throw new Error(`Missing value for query variable ${placeholderName}`)
      }
      if (getPrismaValuePlaceholderType(arg) === 'DateTime' && typeof found === 'string') {
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
    const argType = argTypes[i]
    if (isTupleArgType(argType)) {
      throw new Error('Malformed query template. Unexpected tuple argument type in a flat query.')
    }
    result[i] = toArgType(argType)
  }
  return result
}

function renderTemplateSql(
  fragments: DeepReadonly<Fragment[]>,
  placeholderPrefix: string,
  placeholderHasNumbering: boolean,
  params: unknown[],
  argTypes: DeepReadonly<DynamicArgType[]>,
): SqlQuery {
  let sql = ''
  let placeholderNumber = 1
  let paramIndex = 0
  const flattenedParams: unknown[] = []
  const flattenedArgTypes: ArgType[] = []

  for (const fragment of fragments) {
    if (typeof fragment === 'string') {
      sql += fragment
      continue
    }

    if (fragment === null) {
      if (paramIndex >= params.length) {
        throw new Error(`Malformed query template. Fragments attempt to read over ${params.length} parameters.`)
      }

      if (placeholderHasNumbering) {
        sql += `${placeholderPrefix}${placeholderNumber++}`
      } else {
        sql += placeholderPrefix
      }
      flattenedParams.push(params[paramIndex])
      appendArgTypes(flattenedArgTypes, argTypes[paramIndex], 1)
      paramIndex++
      continue
    }

    if (isCompactTupleFragment(fragment)) {
      if (fragment[0] === 'T') {
        if (paramIndex >= params.length) {
          throw new Error(`Malformed query template. Fragments attempt to read over ${params.length} parameters.`)
        }

        const value = params[paramIndex]
        const tuple = Array.isArray(value) ? value : [value]
        sql += renderTuplePlaceholders(
          fragment,
          tuple.length,
          placeholderPrefix,
          placeholderHasNumbering,
          placeholderNumber,
        )
        placeholderNumber += tuple.length
        pushAll(flattenedParams, tuple)
        appendArgTypes(flattenedArgTypes, argTypes[paramIndex], tuple.length)
        paramIndex++
        continue
      }

      if (fragment[0] === 'L') {
        if (paramIndex >= params.length) {
          throw new Error(`Malformed query template. Fragments attempt to read over ${params.length} parameters.`)
        }

        const value = params[paramIndex]
        if (!Array.isArray(value)) {
          throw new Error(`Malformed query template. Tuple list expected.`)
        }
        if (value.length === 0) {
          throw new Error(`Malformed query template. Tuple list cannot be empty.`)
        }

        let added = 0
        for (let tupleIndex = 0; tupleIndex < value.length; tupleIndex++) {
          const tuple = value[tupleIndex]
          if (!Array.isArray(tuple)) {
            throw new Error(`Malformed query template. Tuple expected.`)
          }

          if (tupleIndex > 0) {
            sql += getGroupSeparator(fragment)
          }

          sql += renderTuplePlaceholders(
            fragment,
            tuple.length,
            placeholderPrefix,
            placeholderHasNumbering,
            placeholderNumber,
          )
          placeholderNumber += tuple.length
          pushAll(flattenedParams, tuple)
          added += tuple.length
        }

        appendArgTypes(flattenedArgTypes, argTypes[paramIndex], added)
        paramIndex++
        continue
      }

      throw new Error(`Invalid fragment type`)
    }

    switch (fragment.type) {
      case 'stringChunk': {
        sql += fragment.chunk
        break
      }

      case 'parameter': {
        if (paramIndex >= params.length) {
          throw new Error(`Malformed query template. Fragments attempt to read over ${params.length} parameters.`)
        }

        if (placeholderHasNumbering) {
          sql += `${placeholderPrefix}${placeholderNumber++}`
        } else {
          sql += placeholderPrefix
        }
        flattenedParams.push(params[paramIndex])
        appendArgTypes(flattenedArgTypes, argTypes[paramIndex], 1)
        paramIndex++
        break
      }

      case 'parameterTuple': {
        if (paramIndex >= params.length) {
          throw new Error(`Malformed query template. Fragments attempt to read over ${params.length} parameters.`)
        }

        const value = params[paramIndex]
        const tuple = Array.isArray(value) ? value : [value]
        sql += renderTuplePlaceholders(
          fragment,
          tuple.length,
          placeholderPrefix,
          placeholderHasNumbering,
          placeholderNumber,
        )
        placeholderNumber += tuple.length
        pushAll(flattenedParams, tuple)
        appendArgTypes(flattenedArgTypes, argTypes[paramIndex], tuple.length)
        paramIndex++
        break
      }

      case 'parameterTupleList': {
        if (paramIndex >= params.length) {
          throw new Error(`Malformed query template. Fragments attempt to read over ${params.length} parameters.`)
        }

        const value = params[paramIndex]
        if (!Array.isArray(value)) {
          throw new Error(`Malformed query template. Tuple list expected.`)
        }
        if (value.length === 0) {
          throw new Error(`Malformed query template. Tuple list cannot be empty.`)
        }

        let added = 0
        for (let tupleIndex = 0; tupleIndex < value.length; tupleIndex++) {
          const tuple = value[tupleIndex]
          if (!Array.isArray(tuple)) {
            throw new Error(`Malformed query template. Tuple expected.`)
          }

          if (tupleIndex > 0) {
            sql += fragment.groupSeparator
          }

          sql += renderTuplePlaceholders(
            fragment,
            tuple.length,
            placeholderPrefix,
            placeholderHasNumbering,
            placeholderNumber,
          )
          placeholderNumber += tuple.length
          pushAll(flattenedParams, tuple)
          added += tuple.length
        }

        appendArgTypes(flattenedArgTypes, argTypes[paramIndex], added)
        paramIndex++
        break
      }

      default:
        assertNever(fragment, 'Invalid fragment type')
    }
  }

  return {
    sql,
    args: flattenedParams,
    argTypes: flattenedArgTypes,
  }
}

function renderTuplePlaceholders(
  fragment: DeepReadonly<TupleFragment>,
  length: number,
  placeholderPrefix: string,
  placeholderHasNumbering: boolean,
  placeholderNumber: number,
): string {
  if (length === 0) {
    return isParameterTupleFragment(fragment) ? '(NULL)' : `${getItemPrefix(fragment)}${getItemSuffix(fragment)}`
  }

  let result = ''
  if (isParameterTupleFragment(fragment)) {
    for (let i = 0; i < length; i++) {
      if (i > 0) {
        result += getItemSeparator(fragment)
      }
      result += getItemPrefix(fragment)
      if (placeholderHasNumbering) {
        result += `${placeholderPrefix}${placeholderNumber++}`
      } else {
        result += placeholderPrefix
      }
      result += getItemSuffix(fragment)
    }
    return `(${result})`
  }

  result += getItemPrefix(fragment)
  for (let i = 0; i < length; i++) {
    if (i > 0) {
      result += getItemSeparator(fragment)
    }
    if (placeholderHasNumbering) {
      result += `${placeholderPrefix}${placeholderNumber++}`
    } else {
      result += placeholderPrefix
    }
  }
  result += getItemSuffix(fragment)

  return result
}

function isParameterTupleFragment(fragment: DeepReadonly<TupleFragment>): boolean {
  return isCompactTupleFragment(fragment) ? fragment[0] === 'T' : fragment.type === 'parameterTuple'
}

function getItemPrefix(fragment: DeepReadonly<TupleFragment>): string {
  return isCompactTupleFragment(fragment) ? fragment[1] : fragment.itemPrefix
}

function getItemSeparator(fragment: DeepReadonly<TupleFragment>): string {
  return isCompactTupleFragment(fragment) ? fragment[2] : fragment.itemSeparator
}

function getItemSuffix(fragment: DeepReadonly<TupleFragment>): string {
  return isCompactTupleFragment(fragment) ? fragment[3] : fragment.itemSuffix
}

function getGroupSeparator(fragment: DeepReadonly<TupleFragment>): string {
  return isCompactTupleFragment(fragment)
    ? fragment[0] === 'L'
      ? fragment[4]
      : ''
    : 'groupSeparator' in fragment
      ? fragment.groupSeparator
      : ''
}

function isCompactTupleFragment(
  fragment: DeepReadonly<Fragment> | undefined,
): fragment is DeepReadonly<CompactTupleFragment> {
  return Array.isArray(fragment)
}

function appendArgTypes(flattenedArgTypes: ArgType[], argType: DeepReadonly<DynamicArgType>, added: number): void {
  if (isTupleArgType(argType)) {
    if (added % argType.elements.length !== 0) {
      throw new Error(
        `Malformed query template. Expected the number of parameters to match the tuple arity, but got ${added} parameters for a tuple of arity ${argType.elements.length}.`,
      )
    }

    for (let i = 0; i < added / argType.elements.length; i++) {
      pushAll(flattenedArgTypes, argType.elements)
    }
  } else {
    const flattenedArgType = toArgType(argType)
    for (let i = 0; i < added; i++) {
      flattenedArgTypes.push(flattenedArgType)
    }
  }
}

function isTupleArgType(
  argType: DeepReadonly<DynamicArgType>,
): argType is DeepReadonly<{ arity: 'tuple'; elements: QueryPlanArgType[] }> {
  return typeof argType === 'object' && argType.arity === 'tuple'
}

function toArgType(argType: DeepReadonly<QueryPlanArgType>): ArgType {
  return typeof argType === 'string' ? SCALAR_ARG_TYPES[argType] : (argType as ArgType)
}

function pushAll<T>(target: T[], values: readonly T[]): void {
  for (let i = 0; i < values.length; i++) {
    target.push(values[i])
  }
}

function renderRawSql(sql: string, params: unknown[], argTypes: DeepReadonly<DynamicArgType[]>): SqlQuery {
  return {
    sql,
    args: params,
    argTypes: copyArgTypes(argTypes, argTypes.length),
  }
}

function doesRequireEvaluation(param: unknown): param is PrismaValuePlaceholder | PrismaValueGenerator {
  return isPrismaValuePlaceholder(param) || isPrismaValueGenerator(param)
}

function chunkParams(fragments: DeepReadonly<Fragment[]>, params: unknown[], maxChunkSize?: number): unknown[][] {
  if (maxChunkSize === undefined) {
    return [params]
  }

  // Find out the total number of parameters once flattened and what the maximum number of
  // parameters in a single fragment is.
  let totalParamCount = 0
  let maxParamsPerFragment = 0
  let paramIndex = 0
  for (const fragment of fragments) {
    if (typeof fragment === 'string') {
      continue
    }

    if (fragment === null) {
      getParam(params, paramIndex++)
      maxParamsPerFragment = Math.max(maxParamsPerFragment, 1)
      totalParamCount++
      continue
    }

    if (isCompactTupleFragment(fragment)) {
      let paramSize = 0
      if (fragment[0] === 'T') {
        paramSize = getTupleParam(params, paramIndex++).length
      } else if (fragment[0] === 'L') {
        paramSize = countTupleListParams(getTupleListParam(params, paramIndex++))
      } else {
        throw new Error(`Invalid fragment type`)
      }

      maxParamsPerFragment = Math.max(maxParamsPerFragment, paramSize)
      totalParamCount += paramSize
      continue
    }

    let paramSize = 0
    switch (fragment.type) {
      case 'parameter': {
        getParam(params, paramIndex++)
        paramSize = 1
        break
      }

      case 'stringChunk': {
        break
      }

      case 'parameterTuple': {
        paramSize = getTupleParam(params, paramIndex++).length
        break
      }

      case 'parameterTupleList': {
        paramSize = countTupleListParams(getTupleListParam(params, paramIndex++))
        break
      }

      default:
        assertNever(fragment, 'Invalid fragment type')
    }

    maxParamsPerFragment = Math.max(maxParamsPerFragment, paramSize)
    totalParamCount += paramSize
  }

  if (totalParamCount <= maxChunkSize) {
    return [params]
  }

  let chunkedParams: unknown[][] = [[]]
  paramIndex = 0
  for (const fragment of fragments) {
    if (typeof fragment === 'string') {
      continue
    }

    if (fragment === null) {
      const param = getParam(params, paramIndex++)
      for (const chunkedParam of chunkedParams) {
        chunkedParam.push(param)
      }
      continue
    }

    if (isCompactTupleFragment(fragment)) {
      if (fragment[0] === 'T') {
        const tuple = getTupleParam(params, paramIndex++)
        const thisParamCount = tuple.length
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
          chunks = chunkArray(tuple, availableSize)
        } else {
          chunks = [tuple]
        }

        chunkedParams = appendChunkVariants(chunkedParams, chunks)
        continue
      }

      if (fragment[0] === 'L') {
        const tupleList = getTupleListParam(params, paramIndex++)
        const thisParamCount = countTupleListParams(tupleList)

        const completeChunks: unknown[][][] = []
        let currentChunk: unknown[][] = []
        let currentChunkParamCount = 0

        for (const tuple of tupleList) {
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

        chunkedParams = appendChunkVariants(chunkedParams, completeChunks)
        continue
      }

      throw new Error(`Invalid fragment type`)
    }

    switch (fragment.type) {
      case 'parameter': {
        const param = getParam(params, paramIndex++)
        for (const chunkedParam of chunkedParams) {
          chunkedParam.push(param)
        }
        break
      }

      case 'stringChunk': {
        break
      }

      case 'parameterTuple': {
        const tuple = getTupleParam(params, paramIndex++)
        const thisParamCount = tuple.length
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
          chunks = chunkArray(tuple, availableSize)
        } else {
          chunks = [tuple]
        }

        chunkedParams = appendChunkVariants(chunkedParams, chunks)
        break
      }

      case 'parameterTupleList': {
        const tupleList = getTupleListParam(params, paramIndex++)
        const thisParamCount = countTupleListParams(tupleList)

        const completeChunks: unknown[][][] = []
        let currentChunk: unknown[][] = []
        let currentChunkParamCount = 0

        for (const tuple of tupleList) {
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

        chunkedParams = appendChunkVariants(chunkedParams, completeChunks)
        break
      }

      default:
        assertNever(fragment, 'Invalid fragment type')
    }
  }

  return chunkedParams
}

function getParam(params: unknown[], index: number): unknown {
  if (index >= params.length) {
    throw new Error(`Malformed query template. Fragments attempt to read over ${params.length} parameters.`)
  }
  return params[index]
}

function getTupleParam(params: unknown[], index: number): unknown[] {
  const value = getParam(params, index)
  return Array.isArray(value) ? value : [value]
}

function getTupleListParam(params: unknown[], index: number): unknown[][] {
  const value = getParam(params, index)
  if (!Array.isArray(value)) {
    throw new Error(`Malformed query template. Tuple list expected.`)
  }
  if (value.length === 0) {
    throw new Error(`Malformed query template. Tuple list cannot be empty.`)
  }
  for (let i = 0; i < value.length; i++) {
    if (!Array.isArray(value[i])) {
      throw new Error(`Malformed query template. Tuple expected.`)
    }
  }
  return value
}

function countTupleListParams(tupleList: unknown[][]): number {
  let count = 0
  for (let i = 0; i < tupleList.length; i++) {
    count += tupleList[i].length
  }
  return count
}

function appendChunkVariants(chunkedParams: unknown[][], chunks: unknown[][]): unknown[][] {
  if (chunks.length === 1) {
    const chunk = chunks[0]
    for (let i = 0; i < chunkedParams.length; i++) {
      chunkedParams[i].push(chunk)
    }
    return chunkedParams
  }

  const result = new Array<unknown[]>(chunkedParams.length * chunks.length)
  let resultIndex = 0
  for (let paramsIndex = 0; paramsIndex < chunkedParams.length; paramsIndex++) {
    const params = chunkedParams[paramsIndex]
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      result[resultIndex++] = [...params, chunks[chunkIndex]]
    }
  }
  return result
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize))
  }
  return result
}
