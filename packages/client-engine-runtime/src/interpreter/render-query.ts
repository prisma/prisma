import type { ArgScalarType, ArgType, SqlQuery } from '@prisma/driver-adapter-utils'

import {
  type CompactParameterTupleFragment,
  type CompactParameterTupleListFragment,
  type DynamicArgType,
  type Fragment,
  getPrismaValueGeneratorArgs,
  getPrismaValueGeneratorName,
  getPrismaValuePlaceholderName,
  getPrismaValuePlaceholderType,
  isPrismaValueGenerator,
  isPrismaValuePlaceholder,
  type PrismaValueGenerator,
  type PrismaValuePlaceholder,
  type QueryPlanArgScalarType,
  type QueryPlanArgType,
  type QueryPlanCompactTemplateSql,
  type QueryPlanDbQuery,
  type QueryPlanRawSql,
} from '../query-plan'
import { UserFacingError } from '../user-facing-error'
import { assertNever, DeepReadonly } from '../utils'
import { GeneratorRegistrySnapshot } from './generators'
import { ScopeBindings } from './scope'

const EMPTY_ARGS = Object.freeze([]) as unknown as unknown[]
const EMPTY_ARG_TYPES = Object.freeze([]) as unknown as ArgType[]
const STRING_ARG_TYPE = Object.freeze({ arity: 'scalar', scalarType: 'string' }) satisfies ArgType
const INT_ARG_TYPE = Object.freeze({ arity: 'scalar', scalarType: 'int' }) satisfies ArgType
const BIGINT_ARG_TYPE = Object.freeze({ arity: 'scalar', scalarType: 'bigint' }) satisfies ArgType
const FLOAT_ARG_TYPE = Object.freeze({ arity: 'scalar', scalarType: 'float' }) satisfies ArgType
const DECIMAL_ARG_TYPE = Object.freeze({ arity: 'scalar', scalarType: 'decimal' }) satisfies ArgType
const BOOLEAN_ARG_TYPE = Object.freeze({ arity: 'scalar', scalarType: 'boolean' }) satisfies ArgType
const ENUM_ARG_TYPE = Object.freeze({ arity: 'scalar', scalarType: 'enum' }) satisfies ArgType
const UUID_ARG_TYPE = Object.freeze({ arity: 'scalar', scalarType: 'uuid' }) satisfies ArgType
const JSON_ARG_TYPE = Object.freeze({ arity: 'scalar', scalarType: 'json' }) satisfies ArgType
const DATETIME_ARG_TYPE = Object.freeze({ arity: 'scalar', scalarType: 'datetime' }) satisfies ArgType
const BYTES_ARG_TYPE = Object.freeze({ arity: 'scalar', scalarType: 'bytes' }) satisfies ArgType
const UNKNOWN_ARG_TYPE = Object.freeze({ arity: 'scalar', scalarType: 'unknown' }) satisfies ArgType
const SCALAR_ARG_TYPES: Record<QueryPlanArgScalarType, ArgType> = Object.freeze({
  s: STRING_ARG_TYPE,
  i: INT_ARG_TYPE,
  I: BIGINT_ARG_TYPE,
  f: FLOAT_ARG_TYPE,
  d: DECIMAL_ARG_TYPE,
  b: BOOLEAN_ARG_TYPE,
  e: ENUM_ARG_TYPE,
  u: UUID_ARG_TYPE,
  j: JSON_ARG_TYPE,
  D: DATETIME_ARG_TYPE,
  B: BYTES_ARG_TYPE,
  '?': UNKNOWN_ARG_TYPE,
})
const SCALAR_ARG_TYPE_NAMES: Record<QueryPlanArgScalarType, ArgScalarType> = Object.freeze({
  s: 'string',
  i: 'int',
  I: 'bigint',
  f: 'float',
  d: 'decimal',
  b: 'boolean',
  e: 'enum',
  u: 'uuid',
  j: 'json',
  D: 'datetime',
  B: 'bytes',
  '?': 'unknown',
})

type CompactTemplateSqlQuery = QueryPlanCompactTemplateSql
type CompactTupleFragment = CompactParameterTupleFragment | CompactParameterTupleListFragment
type TupleFragment = CompactTupleFragment

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

  return renderCompactTemplateSqlQuery(
    dbQuery as DeepReadonly<CompactTemplateSqlQuery>,
    scope,
    generators,
    maxChunkSize,
  )
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
      const name = getPrismaValueGeneratorName(arg)
      const args = getPrismaValueGeneratorArgs(arg)
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
  return fragment[0] === 'T'
}

function getItemPrefix(fragment: DeepReadonly<TupleFragment>): string {
  return fragment[1]
}

function getItemSeparator(fragment: DeepReadonly<TupleFragment>): string {
  return fragment[2]
}

function getItemSuffix(fragment: DeepReadonly<TupleFragment>): string {
  return fragment[3]
}

function getGroupSeparator(fragment: DeepReadonly<TupleFragment>): string {
  return fragment[0] === 'L' ? fragment[4] : ''
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
      for (let j = 0; j < argType.elements.length; j++) {
        flattenedArgTypes.push(toArgType(argType.elements[j]))
      }
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
  return typeof argType === 'object' && !Array.isArray(argType) && 'arity' in argType && argType.arity === 'tuple'
}

function toArgType(argType: DeepReadonly<QueryPlanArgType>): ArgType {
  if (typeof argType === 'string') {
    return SCALAR_ARG_TYPES[argType]
  }
  if (typeof argType === 'object' && argType !== null && !Array.isArray(argType)) {
    const objectArgType = argType as { arity?: unknown }
    if (objectArgType.arity === 'list') {
      return argType as ArgType
    }
    throw new Error(`Invalid query argument type: '${getArgTypeKind(argType)}'`)
  }
  if (Array.isArray(argType)) {
    return {
      arity: 'scalar',
      scalarType: SCALAR_ARG_TYPE_NAMES[argType[0]],
      dbType: argType[1],
    }
  }
  throw new Error(`Invalid query argument type: '${getArgTypeKind(argType)}'`)
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

function getArgTypeKind(argType: unknown): string | undefined {
  if (typeof argType === 'object' && argType !== null && !Array.isArray(argType)) {
    const arity = (argType as { arity?: unknown }).arity
    return typeof arity === 'string' ? arity : undefined
  }
  return typeof argType
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
