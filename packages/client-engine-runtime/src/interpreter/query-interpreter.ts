import { ConnectionInfo, SqlQuery, SqlQueryable, SqlResultSet } from '@prisma/driver-adapter-utils'
import type { SqlCommenterPlugin, SqlCommenterQueryInfo } from '@prisma/sqlcommenter'
import { klona } from 'klona'

import { QueryEvent } from '../events'
import {
  type CompactJoinExpression,
  type CompactResultObjectNode,
  FieldInitializer,
  FieldOperation,
  type FieldType,
  getPrismaValueGeneratorArgs,
  getPrismaValueGeneratorName,
  getPrismaValuePlaceholderName,
  getValidationError,
  InMemoryOps,
  isPrismaValueGenerator,
  isPrismaValuePlaceholder,
  JoinExpression,
  type QueryPlanBinding,
  type QueryPlanCompactNode,
  QueryPlanDbQuery,
  QueryPlanNode,
  type QueryPlanRawSql,
  type RawNestedReadDirectRelation,
  type RawNestedReadQuery,
  type RawNestedReadRelation,
  type RawResultColumnMapping,
  type RawResultColumnRef,
  type ResultNode,
} from '../query-plan'
import { type SchemaProvider } from '../schema'
import { appendSqlComment, buildSqlComment } from '../sql-commenter'
import { type TracingHelper, withQuerySpanAndEvent } from '../tracing'
import { type TransactionManager } from '../transaction-manager/transaction-manager'
import { rethrowAsUserFacing, rethrowAsUserFacingRawError } from '../user-facing-error'
import { assertNever, DeepReadonly, DeepUnreadonly } from '../utils'
import { applyDataMap, applyDataMapToResultSet, mapRawFieldValue, type QueryResultFormat } from './data-mapper'
import { GeneratorRegistry, GeneratorRegistrySnapshot } from './generators'
import { getRecordKey, processRecords } from './in-memory-processing'
import { evaluateArg, renderQuery } from './render-query'
import { PrismaObject, ScopeBindings, Value } from './scope'
import { serializeRawSql, serializeSql } from './serialize-sql'
import { doesSatisfyRule, performValidation } from './validation'

export type QueryInterpreterTransactionManager = { enabled: true; manager: TransactionManager } | { enabled: false }

export type QueryInterpreterOptions = {
  onQuery?: (event: QueryEvent) => void
  tracingHelper: TracingHelper
  serializer: (results: SqlResultSet) => Value
  rawSerializer?: (results: SqlResultSet) => Value
  provider?: SchemaProvider
  connectionInfo?: ConnectionInfo
  resultFormat?: QueryResultFormat
}

export type QueryRuntimeOptions = {
  queryable: SqlQueryable
  transactionManager: QueryInterpreterTransactionManager
  scope: Record<string, unknown>
  sqlCommenter?: QueryInterpreterSqlCommenter
}

type QueryRuntimeContext = {
  queryable: SqlQueryable
  transactionManager: QueryInterpreterTransactionManager
  scope: Record<string, unknown>
  generators: GeneratorRegistrySnapshot
  hasSqlCommenter: boolean
  usesQueryInstrumentation: boolean
  sqlCommenter?: QueryInterpreterSqlCommenter
}

export type QueryInterpreterSqlCommenter = {
  plugins: SqlCommenterPlugin[]
  queryInfo: SqlCommenterQueryInfo
}

type CompiledQueryNode = (context: QueryRuntimeContext) => Promise<IntermediateValue>
type CompiledRawNestedReadQuery = (
  context: QueryRuntimeContext,
  scope: Record<string, unknown>,
) => Promise<RawNestedReadResult>
type CompiledRawNestedReadRelation = (
  parentResult: RawNestedReadResult,
  context: QueryRuntimeContext,
  scope: Record<string, unknown>,
) => Promise<void>
type CompiledRawNestedReadRelations = (
  parentResult: RawNestedReadResult,
  context: QueryRuntimeContext,
  scope: Record<string, unknown>,
) => Promise<void>
type CompiledRawNestedRowMapper = (resultSet: SqlResultSet) => PrismaObject[]

const EMPTY_ENUMS: Record<string, Record<string, string>> = Object.freeze({})
const rawResultColumnIndexesCache = new WeakMap<readonly string[], Record<string, number>>()
const rawResultNumericColumnMappingsCache = new WeakMap<
  readonly RawResultColumnMapping[],
  ResolvedRawResultColumnMapping[]
>()
const rawResultColumnMappingsCache = new WeakMap<
  readonly RawResultColumnMapping[],
  WeakMap<readonly string[], ResolvedRawResultColumnMapping[]>
>()

function isObjectResultNode(structure: ResultNode): structure is CompactResultObjectNode {
  return Array.isArray(structure)
}

function isRawSqlQuery(dbQuery: DeepReadonly<QueryPlanDbQuery>): dbQuery is DeepReadonly<QueryPlanRawSql> {
  return (dbQuery as DeepReadonly<QueryPlanRawSql>).type === 'rawSql'
}

type CompactQueryNodeForRuntime = readonly ['q', DeepReadonly<QueryPlanDbQuery>]
type CompactUniqueQueryNodeForRuntime = readonly ['u', CompactQueryNodeForRuntime]

function isCompactQueryNode(node: unknown): node is CompactQueryNodeForRuntime {
  return Array.isArray(node) && node[0] === 'q'
}

function isCompactUniqueQueryNode(node: unknown): node is CompactUniqueQueryNodeForRuntime {
  return Array.isArray(node) && node[0] === 'u' && isCompactQueryNode(node[1])
}

export class QueryInterpreter {
  readonly #onQuery?: (event: QueryEvent) => void
  readonly #generators: GeneratorRegistry = new GeneratorRegistry()
  readonly #tracingHelper: TracingHelper
  readonly #serializer: (results: SqlResultSet) => Value
  readonly #rawSerializer: (results: SqlResultSet) => Value
  readonly #provider?: SchemaProvider
  readonly #maxChunkSize: number | undefined
  readonly #resultFormat: QueryResultFormat
  readonly #compiledCompactNodeCache = new WeakMap<QueryPlanCompactNode, CompiledQueryNode>()

  constructor({
    onQuery,
    tracingHelper,
    serializer,
    rawSerializer,
    provider,
    connectionInfo,
    resultFormat = 'jsonProtocol',
  }: QueryInterpreterOptions) {
    this.#onQuery = onQuery
    this.#tracingHelper = tracingHelper
    this.#serializer = serializer
    this.#rawSerializer = rawSerializer ?? serializer
    this.#provider = provider
    this.#maxChunkSize = getMaxChunkSize(provider, connectionInfo)
    this.#resultFormat = resultFormat
  }

  static forSql(options: {
    onQuery?: (event: QueryEvent) => void
    tracingHelper: TracingHelper
    provider?: SchemaProvider
    connectionInfo?: ConnectionInfo
    resultFormat?: QueryResultFormat
  }): QueryInterpreter {
    return new QueryInterpreter({
      onQuery: options.onQuery,
      tracingHelper: options.tracingHelper,
      serializer: serializeSql,
      rawSerializer: serializeRawSql,
      provider: options.provider,
      connectionInfo: options.connectionInfo,
      resultFormat: options.resultFormat,
    })
  }

  async run(queryPlan: QueryPlanNode, options: QueryRuntimeOptions): Promise<unknown> {
    const hasSqlCommenter = options.sqlCommenter !== undefined && options.sqlCommenter.plugins.length > 0
    try {
      const { value } = await this.interpretNode(queryPlan, {
        ...options,
        generators: queryPlanUsesNowGenerator(queryPlan) ? this.#generators.snapshot() : this.#generators.current(),
        hasSqlCommenter,
        usesQueryInstrumentation: this.#usesQueryInstrumentation(),
      })

      return value
    } catch (e) {
      rethrowAsUserFacing(e)
    }
  }

  private async interpretNode(queryNode: QueryPlanNode, context: QueryRuntimeContext): Promise<IntermediateValue> {
    return this.#getCompiledCompactNode(queryNode)(context)
  }

  #getCompiledNode(node: QueryPlanNode): CompiledQueryNode {
    return this.#getCompiledCompactNode(node)
  }

  #getCompiledCompactNode(node: QueryPlanCompactNode): CompiledQueryNode {
    const cached = this.#compiledCompactNodeCache.get(node)
    if (cached !== undefined) {
      return cached
    }

    const compiled = this.#compileCompactNode(node)
    this.#compiledCompactNodeCache.set(node, compiled)
    return compiled
  }

  #compileCompactNode(node: QueryPlanCompactNode): CompiledQueryNode {
    switch (node[0]) {
      case 'v': {
        const value = node[1]
        return (context) =>
          Promise.resolve({
            value: evaluateArg(value, context.scope, context.generators),
          })
      }

      case 's': {
        const compiledArgs = node[1].map((arg) => this.#getCompiledNode(arg))
        return async (context) => {
          let result: IntermediateValue | undefined
          for (const compiledArg of compiledArgs) {
            result = await compiledArg(context)
          }
          return result ?? { value: undefined }
        }
      }

      case 'g': {
        const name = node[1]
        return (context) => Promise.resolve({ value: context.scope[name] })
      }

      case 'l': {
        const mappedJoin = matchCompactMappedJoin(node)
        if (mappedJoin !== undefined) {
          const compiledParent = this.#getCompiledNode(mappedJoin.parentExpr)
          const compiledChildren = mappedJoin.joinExpressions.map((joinExpr) => this.#getCompiledNode(joinExpr[0]))

          return async (context) => {
            const { value: parent, lastInsertId } = await compiledParent(context)
            if (parent === null) {
              return { value: null, lastInsertId }
            }

            const nestedScope: ScopeBindings = Object.create(context.scope)
            nestedScope[mappedJoin.parentName] = parent
            for (const binding of mappedJoin.mappedBindings) {
              nestedScope[binding.name] = mapField(parent, binding.field)
            }
            const nestedContext = { ...context, scope: nestedScope }

            const joinExpressions = mappedJoin.joinExpressions
            const children =
              joinExpressions.length === 1
                ? [
                    {
                      joinExpr: joinExpressions[0],
                      childRecords: (await compiledChildren[0](nestedContext)).value,
                    },
                  ]
                : await Promise.all(
                    joinExpressions.map(async (joinExpr, index) => ({
                      joinExpr,
                      childRecords: (await compiledChildren[index](nestedContext)).value,
                    })),
                  )

            return {
              value: attachChildrenToParents(parent, children, mappedJoin.canAssumeStrictEquality),
              lastInsertId,
            }
          }
        }

        const nestedSingleChildJoin = matchCompactNestedSingleChildJoin(node)
        if (nestedSingleChildJoin !== undefined) {
          const compiledParent = this.#getCompiledNode(nestedSingleChildJoin.parentExpr)
          const compiledChild = this.#getCompiledNode(nestedSingleChildJoin.childExpr)

          return async (context) => {
            const { value: parent, lastInsertId } = await compiledParent(context)
            if (parent === null) {
              return { value: null, lastInsertId }
            }

            const nestedScope: ScopeBindings = Object.create(context.scope)
            nestedScope[nestedSingleChildJoin.parentName] = parent
            nestedScope[nestedSingleChildJoin.mappedName] = mapField(parent, nestedSingleChildJoin.mappedField)
            const nestedContext = { ...context, scope: nestedScope }

            const { value: childRecords } = await compiledChild(nestedContext)

            return {
              value: attachChildrenToParents(
                parent,
                [
                  {
                    joinExpr: nestedSingleChildJoin.joinExpr,
                    childRecords,
                  },
                ],
                nestedSingleChildJoin.canAssumeStrictEquality,
              ),
              lastInsertId,
            }
          }
        }

        const compiledBindings = node[1].map((binding) => ({
          name: binding[0],
          expr: this.#getCompiledNode(binding[1]),
        }))
        const compiledExpr = this.#getCompiledNode(node[2])

        return async (context) => {
          const nestedScope: ScopeBindings = Object.create(context.scope)
          const nestedContext = { ...context, scope: nestedScope }
          for (const binding of compiledBindings) {
            const { value } = await binding.expr(nestedContext)
            nestedScope[binding.name] = value
          }
          return compiledExpr(nestedContext)
        }
      }

      case 'e': {
        const names = node[1]
        return (context) => {
          for (const name of names) {
            const value = context.scope[name]
            if (!isEmpty(value)) {
              return Promise.resolve({ value })
            }
          }
          return Promise.resolve({ value: [] })
        }
      }

      case 'q': {
        const dbQuery = node[1]
        return async (context) => this.#executeQueryNode(dbQuery, context)
      }

      case 'x': {
        const dbQuery = node[1]
        return async (context) => this.#executeNode(dbQuery, context)
      }

      case 'u': {
        const compiledExpr = this.#getCompiledNode(node[1])
        return async (context) => {
          const { value, lastInsertId } = await compiledExpr(context)
          if (!Array.isArray(value)) {
            return { value, lastInsertId }
          }
          if (value.length > 1) {
            throw new Error(`Expected zero or one element, got ${value.length}`)
          }
          return { value: value[0] ?? null, lastInsertId }
        }
      }

      case 'm': {
        const field = node[1]
        const compiledExpr = this.#getCompiledNode(node[2])
        return async (context) => {
          const { value, lastInsertId } = await compiledExpr(context)
          return { value: mapField(value, field), lastInsertId }
        }
      }

      case 'j': {
        const compiledParent = this.#getCompiledNode(node[1])
        const joinExpressions = node[2]
        const compiledChildren = joinExpressions.map((joinExpr) => this.#getCompiledNode(joinExpr[0]))
        const canAssumeStrictEquality = node[3]

        return async (context) => {
          const { value: parent, lastInsertId } = await compiledParent(context)
          if (parent === null) {
            return { value: null, lastInsertId }
          }

          const children =
            joinExpressions.length === 1
              ? [
                  {
                    joinExpr: joinExpressions[0],
                    childRecords: (await compiledChildren[0](context)).value,
                  },
                ]
              : await Promise.all(
                  joinExpressions.map(async (joinExpr, index) => ({
                    joinExpr,
                    childRecords: (await compiledChildren[index](context)).value,
                  })),
                )

          return { value: attachChildrenToParents(parent, children, canAssumeStrictEquality), lastInsertId }
        }
      }

      case 'd': {
        const expr = node[1]
        const structure = node[2]
        const enums = node[3] ?? EMPTY_ENUMS
        if (isCompactQueryNode(expr) && !isRawSqlQuery(expr[1])) {
          if (isObjectResultNode(structure)) {
            const dbQuery = expr[1]
            return async (context) => {
              const results = await this.#executeQuery(dbQuery, context)
              return {
                value: applyDataMapToResultSet(results, structure, enums, this.#resultFormat),
                lastInsertId: results.lastInsertId,
              }
            }
          }
        } else if (isCompactUniqueQueryNode(expr) && !isRawSqlQuery(expr[1][1])) {
          if (isObjectResultNode(structure)) {
            const dbQuery = expr[1][1]
            return async (context) => {
              const results = await this.#executeQuery(dbQuery, context)
              const value = applyDataMapToResultSet(results, structure, enums, this.#resultFormat)

              if (value.length > 1) {
                throw new Error(`Expected zero or one element, got ${value.length}`)
              }
              return { value: value[0] ?? null, lastInsertId: results.lastInsertId }
            }
          }
        }

        const compiledExpr = this.#getCompiledNode(expr)
        return async (context) => {
          const { value, lastInsertId } = await compiledExpr(context)
          return { value: applyDataMap(value, structure, enums, this.#resultFormat), lastInsertId }
        }
      }

      case 'p': {
        const compiledExpr = this.#getCompiledNode(node[1])
        const operations = node[2]
        return async (context) => {
          const { value, lastInsertId } = await compiledExpr(context)
          const ops = cloneObject(operations)
          evaluateProcessingParameters(ops, context.scope, context.generators)
          return { value: processRecords(value, ops), lastInsertId }
        }
      }

      case 'n': {
        const finalOwnerRead = this.#tryCompileRawNestedFinalOwnerRead(node[1], node[2], node[3] ?? EMPTY_ENUMS)
        if (finalOwnerRead !== undefined) {
          return finalOwnerRead
        }

        const compiledQuery = this.#compileRawNestedReadQuery(node[1], node[3] ?? EMPTY_ENUMS)
        const unique = node[2]
        return async (context) => {
          const result = await compiledQuery(context, context.scope)
          if (!unique) {
            return { value: result.records }
          }

          if (result.records.length > 1) {
            throw new Error(`Expected zero or one element, got ${result.records.length}`)
          }
          return { value: result.records[0] ?? null }
        }
      }

      default:
        return (context) => this.#interpretCompactNode(node, context)
    }
  }

  async #interpretCompactNode(node: QueryPlanCompactNode, context: QueryRuntimeContext): Promise<IntermediateValue> {
    switch (node[0]) {
      case 'v': {
        return {
          value: evaluateArg(node[1], context.scope, context.generators),
        }
      }

      case 's': {
        let result: IntermediateValue | undefined
        for (const arg of node[1]) {
          result = await this.interpretNode(arg, context)
        }
        return result ?? { value: undefined }
      }

      case 'g': {
        return { value: context.scope[node[1]] }
      }

      case 'l': {
        const mappedJoin = matchCompactMappedJoin(node)
        if (mappedJoin !== undefined) {
          const { value: parent, lastInsertId } = await this.interpretNode(mappedJoin.parentExpr, context)
          if (parent === null) {
            return { value: null, lastInsertId }
          }

          const nestedScope: ScopeBindings = Object.create(context.scope)
          nestedScope[mappedJoin.parentName] = parent
          for (const binding of mappedJoin.mappedBindings) {
            nestedScope[binding.name] = mapField(parent, binding.field)
          }
          const nestedContext = { ...context, scope: nestedScope }

          const joinExpressions = mappedJoin.joinExpressions
          const children =
            joinExpressions.length === 1
              ? [
                  {
                    joinExpr: joinExpressions[0],
                    childRecords: (await this.interpretNode(joinExpressions[0][0], nestedContext)).value,
                  },
                ]
              : await Promise.all(
                  joinExpressions.map(async (joinExpr) => ({
                    joinExpr,
                    childRecords: (await this.interpretNode(joinExpr[0], nestedContext)).value,
                  })),
                )

          return {
            value: attachChildrenToParents(parent, children, mappedJoin.canAssumeStrictEquality),
            lastInsertId,
          }
        }

        const nestedSingleChildJoin = matchCompactNestedSingleChildJoin(node)
        if (nestedSingleChildJoin !== undefined) {
          const { value: parent, lastInsertId } = await this.interpretNode(nestedSingleChildJoin.parentExpr, context)
          if (parent === null) {
            return { value: null, lastInsertId }
          }

          const nestedScope: ScopeBindings = Object.create(context.scope)
          nestedScope[nestedSingleChildJoin.parentName] = parent
          nestedScope[nestedSingleChildJoin.mappedName] = mapField(parent, nestedSingleChildJoin.mappedField)
          const nestedContext = { ...context, scope: nestedScope }

          const { value: childRecords } = await this.interpretNode(nestedSingleChildJoin.childExpr, nestedContext)

          return {
            value: attachChildrenToParents(
              parent,
              [
                {
                  joinExpr: nestedSingleChildJoin.joinExpr,
                  childRecords,
                },
              ],
              nestedSingleChildJoin.canAssumeStrictEquality,
            ),
            lastInsertId,
          }
        }

        const nestedScope: ScopeBindings = Object.create(context.scope)
        const nestedContext = { ...context, scope: nestedScope }
        for (const binding of node[1]) {
          const { value } = await this.interpretNode(binding[1], nestedContext)
          nestedScope[binding[0]] = value
        }
        return this.interpretNode(node[2], nestedContext)
      }

      case 'e': {
        for (const name of node[1]) {
          const value = context.scope[name]
          if (!isEmpty(value)) {
            return { value }
          }
        }
        return { value: [] }
      }

      case 'c': {
        const parts = await Promise.all(node[1].map((arg) => this.interpretNode(arg, context).then((res) => res.value)))
        return {
          value: parts.length > 0 ? parts.reduce<Value[]>((acc, part) => acc.concat(asList(part)), []) : [],
        }
      }

      case '+': {
        const parts = await Promise.all(node[1].map((arg) => this.interpretNode(arg, context).then((res) => res.value)))
        return {
          value: parts.length > 0 ? parts.reduce((acc, part) => asNumber(acc) + asNumber(part)) : 0,
        }
      }

      case 'x': {
        const dbQuery = node[1]
        const queries = renderQuery(dbQuery, context.scope, context.generators, this.#maxChunkSize)
        const isRaw = isRawSqlQuery(dbQuery)

        if (!context.hasSqlCommenter && !context.usesQueryInstrumentation && queries.length === 1) {
          const result = context.queryable.executeRaw(asMutable(queries[0]))
          return {
            value: isRaw ? await result.catch(rethrowAsUserFacingRawError) : await result,
          }
        }

        let sum = 0
        for (const query of queries) {
          const queryToExecute = context.hasSqlCommenter ? applyComments(query, context.sqlCommenter!) : query
          if (context.usesQueryInstrumentation) {
            sum += await this.#withQuerySpanAndEvent(queryToExecute, context.queryable, () =>
              isRaw
                ? context.queryable.executeRaw(asMutable(queryToExecute)).catch(rethrowAsUserFacingRawError)
                : context.queryable.executeRaw(asMutable(queryToExecute)),
            )
          } else {
            sum += isRaw
              ? await context.queryable.executeRaw(asMutable(queryToExecute)).catch(rethrowAsUserFacingRawError)
              : await context.queryable.executeRaw(asMutable(queryToExecute))
          }
        }

        return { value: sum }
      }

      case 'q': {
        const dbQuery = node[1]
        const queries = renderQuery(dbQuery, context.scope, context.generators, this.#maxChunkSize)
        const isRaw = isRawSqlQuery(dbQuery)

        if (!context.hasSqlCommenter && !context.usesQueryInstrumentation && queries.length === 1) {
          const result = context.queryable.queryRaw(asMutable(queries[0]))
          const results = isRaw ? await result.catch(rethrowAsUserFacingRawError) : await result
          return {
            value: isRaw ? this.#rawSerializer(results) : this.#serializer(results),
            lastInsertId: results.lastInsertId,
          }
        }

        let results: SqlResultSet | undefined
        for (const query of queries) {
          const queryToExecute = context.hasSqlCommenter ? applyComments(query, context.sqlCommenter!) : query
          const result = context.usesQueryInstrumentation
            ? await this.#withQuerySpanAndEvent(queryToExecute, context.queryable, () =>
                isRaw
                  ? context.queryable.queryRaw(asMutable(queryToExecute)).catch(rethrowAsUserFacingRawError)
                  : context.queryable.queryRaw(asMutable(queryToExecute)),
              )
            : isRaw
              ? await context.queryable.queryRaw(asMutable(queryToExecute)).catch(rethrowAsUserFacingRawError)
              : await context.queryable.queryRaw(asMutable(queryToExecute))
          if (results === undefined) {
            results = result
          } else {
            results.rows.push(...result.rows)
            results.lastInsertId = result.lastInsertId
          }
        }

        return {
          value: isRaw ? this.#rawSerializer(results!) : this.#serializer(results!),
          lastInsertId: results?.lastInsertId,
        }
      }

      case 'R': {
        const { value, lastInsertId } = await this.interpretNode(node[1], context)
        return { value: Array.isArray(value) ? value.reverse() : value, lastInsertId }
      }

      case 'u': {
        const { value, lastInsertId } = await this.interpretNode(node[1], context)
        if (!Array.isArray(value)) {
          return { value, lastInsertId }
        }
        if (value.length > 1) {
          throw new Error(`Expected zero or one element, got ${value.length}`)
        }
        return { value: value[0] ?? null, lastInsertId }
      }

      case 'r': {
        const { value, lastInsertId } = await this.interpretNode(node[1], context)
        if (isEmpty(value)) {
          throw new Error('Required value is empty')
        }
        return { value, lastInsertId }
      }

      case 'm': {
        const { value, lastInsertId } = await this.interpretNode(node[2], context)
        return { value: mapField(value, node[1]), lastInsertId }
      }

      case 'j': {
        const { value: parent, lastInsertId } = await this.interpretNode(node[1], context)

        if (parent === null) {
          return { value: null, lastInsertId }
        }

        const joinExpressions = node[2]
        const children =
          joinExpressions.length === 1
            ? [
                {
                  joinExpr: joinExpressions[0],
                  childRecords: (await this.interpretNode(joinExpressions[0][0], context)).value,
                },
              ]
            : await Promise.all(
                joinExpressions.map(async (joinExpr) => ({
                  joinExpr,
                  childRecords: (await this.interpretNode(joinExpr[0], context)).value,
                })),
              )

        return { value: attachChildrenToParents(parent, children, node[3]), lastInsertId }
      }

      case 't': {
        if (!context.transactionManager.enabled) {
          return this.interpretNode(node[1], context)
        }

        const transactionManager = context.transactionManager.manager
        const transactionInfo = await transactionManager.startInternalTransaction()
        const transaction = await transactionManager.getTransaction(transactionInfo, 'query')
        try {
          const value = await this.interpretNode(node[1], { ...context, queryable: transaction })
          await transactionManager.commitTransaction(transactionInfo.id)
          return value
        } catch (e) {
          await transactionManager.rollbackTransaction(transactionInfo.id)
          throw e
        }
      }

      case 'd': {
        const expr = node[1]
        const structure = node[2]
        const enums = node[3] ?? EMPTY_ENUMS
        if (isCompactQueryNode(expr) && !isRawSqlQuery(expr[1])) {
          if (isObjectResultNode(structure)) {
            const results = await this.#executeQuery(expr[1], context)
            return {
              value: applyDataMapToResultSet(results, structure, enums, this.#resultFormat),
              lastInsertId: results.lastInsertId,
            }
          }
        } else if (isCompactUniqueQueryNode(expr) && !isRawSqlQuery(expr[1][1])) {
          if (isObjectResultNode(structure)) {
            const results = await this.#executeQuery(expr[1][1], context)
            const value = applyDataMapToResultSet(results, structure, enums, this.#resultFormat)

            if (value.length > 1) {
              throw new Error(`Expected zero or one element, got ${value.length}`)
            }
            return { value: value[0] ?? null, lastInsertId: results.lastInsertId }
          }
        }

        const { value, lastInsertId } = await this.interpretNode(expr, context)
        return { value: applyDataMap(value, structure, enums, this.#resultFormat), lastInsertId }
      }

      case 'V': {
        const { value, lastInsertId } = await this.interpretNode(node[1], context)
        performValidation(value, node[2], getValidationError(node[3], node[4]))

        return { value, lastInsertId }
      }

      case '?': {
        const { value } = await this.interpretNode(node[1], context)
        if (doesSatisfyRule(value, node[2])) {
          return await this.interpretNode(node[3], context)
        } else {
          return await this.interpretNode(node[4], context)
        }
      }

      case '0': {
        return { value: undefined }
      }

      case '-': {
        const { value: from } = await this.interpretNode(node[1], context)
        const { value: to } = await this.interpretNode(node[2], context)

        const keyGetter = (item: Value) => (item !== null ? getRecordKey(asRecord(item), node[3]) : null)

        const toSet = new Set(asList(to).map(keyGetter))
        return { value: asList(from).filter((item) => !toSet.has(keyGetter(item))) }
      }

      case 'p': {
        const { value, lastInsertId } = await this.interpretNode(node[1], context)
        const ops = cloneObject(node[2])
        evaluateProcessingParameters(ops, context.scope, context.generators)
        return { value: processRecords(value, ops), lastInsertId }
      }

      case 'i': {
        const { lastInsertId } = await this.interpretNode(node[1], context)

        const record = {}
        for (const [key, initializer] of Object.entries(node[2]) as [string, DeepReadonly<FieldInitializer>][]) {
          record[key] = evalFieldInitializer(initializer, lastInsertId, context.scope, context.generators)
        }
        return { value: record, lastInsertId }
      }

      case 'M': {
        const { value, lastInsertId } = await this.interpretNode(node[1], context)

        const record = value === null ? {} : asRecord(value)
        for (const [key, entry] of Object.entries(node[2]) as [string, DeepReadonly<FieldOperation>][]) {
          record[key] = evalFieldOperation(entry, record[key], context.scope, context.generators)
        }
        return { value: record, lastInsertId }
      }

      default:
        throw new Error(`Unexpected compact node type: ${node[0]}`)
    }
  }

  #tryCompileRawNestedFinalOwnerRead(
    query: RawNestedReadQuery,
    unique: boolean,
    enums: Record<string, Record<string, string>>,
  ): CompiledQueryNode | undefined {
    if (!unique || this.#resultFormat !== 'js' || Object.keys(enums).length !== 0) {
      return undefined
    }

    const program = tryCompileRawNestedFinalOwnerProgram(query)
    if (program === undefined) {
      return undefined
    }

    const fallbackQuery = this.#compileRawNestedReadQuery(query, enums)

    return async (context) => {
      if (context.hasSqlCommenter || context.usesQueryInstrumentation) {
        const fallbackResult = await fallbackQuery(context, context.scope)
        if (fallbackResult.records.length > 1) {
          throw new Error(`Expected zero or one element, got ${fallbackResult.records.length}`)
        }
        return { value: fallbackResult.records[0] ?? null }
      }

      const rootResultSet = await this.#executeRawNestedReadDbQuery(program.rootQuery, context, context.scope)
      if (rootResultSet.rows.length > 1) {
        throw new Error(`Expected zero or one element, got ${rootResultSet.rows.length}`)
      }

      const rootRow = rootResultSet.rows[0]
      if (rootRow === undefined) {
        return { value: null }
      }

      const root = program.writeRoot(rootRow)
      const rootKey = rootRow[program.rootKeyColumnIndex]
      const unique0 = program.uniqueRelations[0]
      const unique1 = program.uniqueRelations[1]
      const wrapperList = program.wrapperListRelation
      const childList = program.childListRelation

      const [uniqueResult0, uniqueResult1, wrapperResultSet, childListResultSet] = await Promise.all([
        this.#executeRawNestedReadDbQuery(
          unique0.query,
          context,
          createRawNestedRelationScope(
            context.scope,
            unique0.scopeName,
            rootRow[unique0.parentColumnIndex],
            unique0.canUseLocalScope,
          ),
        ),
        this.#executeRawNestedReadDbQuery(
          unique1.query,
          context,
          createRawNestedRelationScope(
            context.scope,
            unique1.scopeName,
            rootRow[unique1.parentColumnIndex],
            unique1.canUseLocalScope,
          ),
        ),
        this.#executeRawNestedReadDbQuery(
          wrapperList.sourceQuery,
          context,
          createRawNestedRelationScope(
            context.scope,
            wrapperList.sourceScopeName,
            rootKey,
            wrapperList.canUseLocalSourceScope,
          ),
        ),
        this.#executeRawNestedReadDbQuery(
          childList.query,
          context,
          createRawNestedRelationScope(context.scope, childList.scopeName, rootKey, childList.canUseLocalScope),
        ),
      ])

      root[unique0.fieldName] = mapRawNestedFirstFinalOwnerChild(
        uniqueResult0.rows,
        unique0.childColumnIndex,
        rootRow[unique0.parentColumnIndex],
        unique0.writeChild,
      )
      root[unique1.fieldName] = mapRawNestedFirstFinalOwnerChild(
        uniqueResult1.rows,
        unique1.childColumnIndex,
        rootRow[unique1.parentColumnIndex],
        unique1.writeChild,
      )

      const wrapperRows = wrapperResultSet.rows
      const childListRows = childListResultSet.rows
      const listRecords: PrismaObject[] = []
      const childTargets: RawNestedFinalOwnerChildTarget[] = []
      const childTargetIds: unknown[] = []
      const seenChildTargetIds = new Set<unknown>()

      for (let rowIndex = 0; rowIndex < childListRows.length; rowIndex++) {
        const row = childListRows[rowIndex]
        if (row[childList.childColumnIndex] !== rootKey) {
          continue
        }

        const childRecord = childList.writeChild(row)
        listRecords.push(childRecord)

        const targetId = row[childList.uniqueRelationParentColumnIndex]
        childTargets.push({ id: targetId, record: childRecord })
        if (!seenChildTargetIds.has(targetId)) {
          seenChildTargetIds.add(targetId)
          childTargetIds.push(targetId)
        }
      }
      root[childList.fieldName] = listRecords

      const wrapperTargetIds = getRawNestedScopeValue(wrapperRows, wrapperList.wrapperChildColumnIndex)
      const hasWrapperTargets = wrapperRows.length > 0
      const hasChildTargets = childTargetIds.length > 0

      if (!hasWrapperTargets && !hasChildTargets) {
        root[wrapperList.fieldName] = []
        return { value: root }
      }

      if (hasWrapperTargets && hasChildTargets) {
        const [wrapperChildResultSet, childTargetResultSet] = await Promise.all([
          this.#executeRawNestedReadDbQuery(
            wrapperList.childQuery,
            context,
            createRawNestedRelationScope(
              context.scope,
              wrapperList.childScopeName,
              wrapperTargetIds,
              wrapperList.canUseLocalChildScope,
            ),
          ),
          this.#executeRawNestedReadDbQuery(
            childList.uniqueRelationQuery,
            context,
            createRawNestedRelationScope(
              context.scope,
              childList.uniqueRelationScopeName,
              childTargetIds,
              childList.canUseLocalUniqueRelationScope,
            ),
          ),
        ])
        root[wrapperList.fieldName] = mapRawNestedFinalOwnerWrapperList(
          rootKey,
          wrapperList,
          wrapperRows,
          wrapperChildResultSet.rows,
        )
        attachRawNestedFinalOwnerUniqueChildren(childTargets, childList, childTargetResultSet.rows)
      } else if (hasWrapperTargets) {
        const wrapperChildResultSet = await this.#executeRawNestedReadDbQuery(
          wrapperList.childQuery,
          context,
          createRawNestedRelationScope(
            context.scope,
            wrapperList.childScopeName,
            wrapperTargetIds,
            wrapperList.canUseLocalChildScope,
          ),
        )
        root[wrapperList.fieldName] = mapRawNestedFinalOwnerWrapperList(
          rootKey,
          wrapperList,
          wrapperRows,
          wrapperChildResultSet.rows,
        )
      } else {
        root[wrapperList.fieldName] = []
        const childTargetResultSet = await this.#executeRawNestedReadDbQuery(
          childList.uniqueRelationQuery,
          context,
          createRawNestedRelationScope(
            context.scope,
            childList.uniqueRelationScopeName,
            childTargetIds,
            childList.canUseLocalUniqueRelationScope,
          ),
        )
        attachRawNestedFinalOwnerUniqueChildren(childTargets, childList, childTargetResultSet.rows)
      }

      return { value: root }
    }
  }

  #compileRawNestedReadQuery(
    query: RawNestedReadQuery,
    enums: Record<string, Record<string, string>>,
  ): CompiledRawNestedReadQuery {
    const dbQuery = query[0]
    const mappings = query[1]
    const rawRelations = query[2]
    const uniqueWrapperRelation = getRawNestedUniqueWrapperRelation(mappings, rawRelations)
    if (uniqueWrapperRelation !== undefined) {
      return this.#compileRawNestedUniqueWrapperReadQuery(dbQuery, uniqueWrapperRelation, enums)
    }

    const relations =
      rawRelations === undefined
        ? undefined
        : compileRawNestedReadRelations(
            rawRelations.map((relation) => this.#compileRawNestedReadRelation(relation, enums)),
          )
    const mapRows = compileRawNestedRowMapper(mappings, enums, this.#resultFormat)

    return async (context, scope) => {
      const resultSet = await this.#executeRawNestedReadDbQuery(dbQuery, context, scope)
      const records = mapRows(resultSet)
      const result: RawNestedReadResult = {
        rows: resultSet.rows,
        columnNames: resultSet.columnNames,
        records,
      }
      if (relations !== undefined && resultSet.rows.length > 0) {
        await relations(result, context, scope)
      }

      return result
    }
  }

  #compileRawNestedUniqueWrapperReadQuery(
    dbQuery: QueryPlanDbQuery,
    relation: RawNestedReadDirectRelation,
    enums: Record<string, Record<string, string>>,
  ): CompiledRawNestedReadQuery {
    const childQuery = this.#compileRawNestedReadQuery(relation[2], enums)
    const canUseLocalChildScope = rawNestedReadQueryCanUseLocalScopes(relation[2], relation[5])

    return async (context, scope) => {
      const resultSet = await this.#executeRawNestedReadDbQuery(dbQuery, context, scope)
      const rows = resultSet.rows
      if (rows.length === 0) {
        return {
          rows,
          columnNames: resultSet.columnNames,
          records: [],
        }
      }

      const parentColumnIndex = resolveRawResultColumnRef(resultSet.columnNames, relation[3])
      const childScope = createRawNestedRelationScope(
        scope,
        relation[5],
        getRawNestedScopeValue(rows, parentColumnIndex),
        canUseLocalChildScope,
      )
      const childResult = await childQuery(context, childScope)
      const childColumnIndex = resolveRawResultColumnRef(childResult.columnNames, relation[4])

      return {
        rows,
        columnNames: resultSet.columnNames,
        records: mapRawNestedUniqueWrapperRows(
          rows,
          parentColumnIndex,
          relation[1],
          childResult.rows,
          childResult.records,
          childColumnIndex,
        ),
      }
    }
  }

  #compileRawNestedReadRelation(
    relation: RawNestedReadRelation,
    enums: Record<string, Record<string, string>>,
  ): CompiledRawNestedReadRelation {
    const uniqueWrapperRelation = getRawNestedUniqueWrapperRelation(relation[2][1], relation[2][2])
    if (uniqueWrapperRelation !== undefined) {
      const compiledUniqueWrapperRelation = this.#tryCompileRawNestedDirectUniqueWrapperReadRelation(
        relation,
        uniqueWrapperRelation,
        enums,
      )
      if (compiledUniqueWrapperRelation !== undefined) {
        return compiledUniqueWrapperRelation
      }
    }

    const childQuery = this.#compileRawNestedReadQuery(relation[2], enums)
    const canUseLocalChildScope = rawNestedReadQueryCanUseLocalScopes(relation[2], relation[5])

    if (typeof relation[3] === 'number' && typeof relation[4] === 'number') {
      const fieldName = relation[1]
      const parentColumnIndex = relation[3]
      const childColumnIndex = relation[4]
      const scopeName = relation[5]
      const isRelationUnique = relation[6]

      return async (parentResult, context, scope) => {
        const childScope = createRawNestedRelationScope(
          scope,
          scopeName,
          getRawNestedScopeValue(parentResult.rows, parentColumnIndex),
          canUseLocalChildScope,
        )
        const childResult = await childQuery(context, childScope)
        attachRawNestedDirectRelationByIndex(
          parentResult.rows,
          parentResult.records,
          fieldName,
          isRelationUnique,
          parentColumnIndex,
          childResult.rows,
          childResult.records,
          childColumnIndex,
        )
      }
    }

    return async (parentResult, context, scope) => {
      const parentColumnIndex = resolveRawResultColumnRef(parentResult.columnNames, relation[3])
      const childScope = createRawNestedRelationScope(
        scope,
        relation[5],
        getRawNestedScopeValue(parentResult.rows, parentColumnIndex),
        canUseLocalChildScope,
      )
      const childResult = await childQuery(context, childScope)
      const childColumnIndex = resolveRawResultColumnRef(childResult.columnNames, relation[4])
      attachRawNestedDirectRelation(
        parentResult.rows,
        parentResult.records,
        relation,
        parentColumnIndex,
        childResult.rows,
        childResult.records,
        childColumnIndex,
      )
    }
  }

  #tryCompileRawNestedDirectUniqueWrapperReadRelation(
    relation: RawNestedReadDirectRelation,
    wrapperRelation: RawNestedReadDirectRelation,
    enums: Record<string, Record<string, string>>,
  ): CompiledRawNestedReadRelation | undefined {
    if (
      typeof relation[3] !== 'number' ||
      typeof relation[4] !== 'number' ||
      typeof wrapperRelation[3] !== 'number' ||
      typeof wrapperRelation[4] !== 'number'
    ) {
      return undefined
    }

    const wrapperDbQuery = relation[2][0]
    const childQuery = this.#compileRawNestedReadQuery(wrapperRelation[2], enums)
    const canUseLocalWrapperScope = rawNestedReadQueryCanUseLocalScopes(relation[2], relation[5])
    const canUseLocalChildScope = rawNestedReadQueryCanUseLocalScopes(wrapperRelation[2], wrapperRelation[5])
    const fieldName = relation[1]
    const parentColumnIndex = relation[3]
    const wrapperParentColumnIndex = relation[4]
    const scopeName = relation[5]
    const isRelationUnique = relation[6]
    const wrapperFieldName = wrapperRelation[1]
    const wrapperChildColumnIndex = wrapperRelation[3]
    const childColumnIndex = wrapperRelation[4]
    const wrapperScopeName = wrapperRelation[5]

    return async (parentResult, context, scope) => {
      const wrapperScope = createRawNestedRelationScope(
        scope,
        scopeName,
        getRawNestedScopeValue(parentResult.rows, parentColumnIndex),
        canUseLocalWrapperScope,
      )
      const wrapperResultSet = await this.#executeRawNestedReadDbQuery(wrapperDbQuery, context, wrapperScope)
      if (wrapperResultSet.rows.length === 0) {
        attachEmptyRawNestedDirectRelation(parentResult.records, fieldName, isRelationUnique)
        return
      }

      const childScope = createRawNestedRelationScope(
        wrapperScope,
        wrapperScopeName,
        getRawNestedScopeValue(wrapperResultSet.rows, wrapperChildColumnIndex),
        canUseLocalChildScope,
      )
      const childResult = await childQuery(context, childScope)
      attachRawNestedDirectUniqueWrapperRelationByIndex(
        parentResult.rows,
        parentResult.records,
        fieldName,
        isRelationUnique,
        parentColumnIndex,
        wrapperResultSet.rows,
        wrapperParentColumnIndex,
        wrapperChildColumnIndex,
        wrapperFieldName,
        childResult.rows,
        childResult.records,
        childColumnIndex,
      )
    }
  }

  async #executeRawNestedReadDbQuery(
    dbQuery: QueryPlanDbQuery,
    context: QueryRuntimeContext,
    scope: Record<string, unknown>,
  ): Promise<SqlResultSet> {
    const queries = renderQuery(dbQuery, scope, context.generators, this.#maxChunkSize)
    if (
      !isRawSqlQuery(dbQuery) &&
      !context.hasSqlCommenter &&
      !context.usesQueryInstrumentation &&
      queries.length === 1
    ) {
      return context.queryable.queryRaw(asMutable(queries[0]))
    }

    return this.#executeQuery(dbQuery, { ...context, scope })
  }

  #withQuerySpanAndEvent<T>(
    query: DeepReadonly<SqlQuery>,
    queryable: SqlQueryable,
    execute: () => Promise<T>,
  ): Promise<T> {
    return withQuerySpanAndEvent({
      query,
      execute,
      provider: this.#provider ?? queryable.provider,
      tracingHelper: this.#tracingHelper,
      onQuery: this.#onQuery,
    })
  }

  #usesQueryInstrumentation(): boolean {
    return this.#onQuery !== undefined || this.#tracingHelper.isEnabled()
  }

  async #executeNode(
    dbQuery: DeepReadonly<QueryPlanDbQuery>,
    context: QueryRuntimeContext,
  ): Promise<IntermediateValue> {
    const queries = renderQuery(dbQuery, context.scope, context.generators, this.#maxChunkSize)
    const isRaw = isRawSqlQuery(dbQuery)

    if (!context.hasSqlCommenter && !context.usesQueryInstrumentation && queries.length === 1) {
      const result = context.queryable.executeRaw(asMutable(queries[0]))
      return {
        value: isRaw ? await result.catch(rethrowAsUserFacingRawError) : await result,
      }
    }

    let sum = 0
    for (const query of queries) {
      const queryToExecute = context.hasSqlCommenter ? applyComments(query, context.sqlCommenter!) : query
      if (context.usesQueryInstrumentation) {
        sum += await this.#withQuerySpanAndEvent(queryToExecute, context.queryable, () =>
          isRaw
            ? context.queryable.executeRaw(asMutable(queryToExecute)).catch(rethrowAsUserFacingRawError)
            : context.queryable.executeRaw(asMutable(queryToExecute)),
        )
      } else {
        sum += isRaw
          ? await context.queryable.executeRaw(asMutable(queryToExecute)).catch(rethrowAsUserFacingRawError)
          : await context.queryable.executeRaw(asMutable(queryToExecute))
      }
    }

    return { value: sum }
  }

  async #executeQueryNode(
    dbQuery: DeepReadonly<QueryPlanDbQuery>,
    context: QueryRuntimeContext,
  ): Promise<IntermediateValue> {
    const queries = renderQuery(dbQuery, context.scope, context.generators, this.#maxChunkSize)
    const isRaw = isRawSqlQuery(dbQuery)

    if (!context.hasSqlCommenter && !context.usesQueryInstrumentation && queries.length === 1) {
      const result = context.queryable.queryRaw(asMutable(queries[0]))
      const results = isRaw ? await result.catch(rethrowAsUserFacingRawError) : await result
      return {
        value: isRaw ? this.#rawSerializer(results) : this.#serializer(results),
        lastInsertId: results.lastInsertId,
      }
    }

    let results: SqlResultSet | undefined
    for (const query of queries) {
      const queryToExecute = context.hasSqlCommenter ? applyComments(query, context.sqlCommenter!) : query
      const result = context.usesQueryInstrumentation
        ? await this.#withQuerySpanAndEvent(queryToExecute, context.queryable, () =>
            isRaw
              ? context.queryable.queryRaw(asMutable(queryToExecute)).catch(rethrowAsUserFacingRawError)
              : context.queryable.queryRaw(asMutable(queryToExecute)),
          )
        : isRaw
          ? await context.queryable.queryRaw(asMutable(queryToExecute)).catch(rethrowAsUserFacingRawError)
          : await context.queryable.queryRaw(asMutable(queryToExecute))
      if (results === undefined) {
        results = result
      } else {
        results.rows.push(...result.rows)
        results.lastInsertId = result.lastInsertId
      }
    }

    return {
      value: isRaw ? this.#rawSerializer(results!) : this.#serializer(results!),
      lastInsertId: results?.lastInsertId,
    }
  }

  async #executeQuery(dbQuery: DeepReadonly<QueryPlanDbQuery>, context: QueryRuntimeContext): Promise<SqlResultSet> {
    const queries = renderQuery(dbQuery, context.scope, context.generators, this.#maxChunkSize)
    const isRaw = isRawSqlQuery(dbQuery)

    if (!context.hasSqlCommenter && !context.usesQueryInstrumentation && queries.length === 1) {
      const result = context.queryable.queryRaw(asMutable(queries[0]))
      return isRaw ? await result.catch(rethrowAsUserFacingRawError) : await result
    }

    let results: SqlResultSet | undefined
    for (const query of queries) {
      const queryToExecute = context.hasSqlCommenter ? applyComments(query, context.sqlCommenter!) : query
      const result = context.usesQueryInstrumentation
        ? await this.#withQuerySpanAndEvent(queryToExecute, context.queryable, () =>
            isRaw
              ? context.queryable.queryRaw(asMutable(queryToExecute)).catch(rethrowAsUserFacingRawError)
              : context.queryable.queryRaw(asMutable(queryToExecute)),
          )
        : isRaw
          ? await context.queryable.queryRaw(asMutable(queryToExecute)).catch(rethrowAsUserFacingRawError)
          : await context.queryable.queryRaw(asMutable(queryToExecute))
      if (results === undefined) {
        results = result
      } else {
        results.rows.push(...result.rows)
        results.lastInsertId = result.lastInsertId
      }
    }

    return results!
  }
}

type RawNestedReadResult = {
  rows: readonly unknown[][]
  columnNames: readonly string[]
  records: PrismaObject[]
}

type RawNestedFinalOwnerProgram = {
  rootQuery: QueryPlanDbQuery
  rootKeyColumnIndex: number
  writeRoot: RawNestedFinalOwnerRowWriter
  uniqueRelations: readonly [RawNestedFinalOwnerUniqueRelation, RawNestedFinalOwnerUniqueRelation]
  wrapperListRelation: RawNestedFinalOwnerWrapperListRelation
  childListRelation: RawNestedFinalOwnerChildListRelation
}

type RawNestedFinalOwnerRowWriter = (row: readonly unknown[]) => PrismaObject

type RawNestedFinalOwnerUniqueRelation = {
  fieldName: string
  query: QueryPlanDbQuery
  parentColumnIndex: number
  childColumnIndex: number
  scopeName: string
  canUseLocalScope: boolean
  writeChild: RawNestedFinalOwnerRowWriter
}

type RawNestedFinalOwnerWrapperListRelation = {
  fieldName: string
  sourceQuery: QueryPlanDbQuery
  sourceParentColumnIndex: number
  sourceChildColumnIndex: number
  sourceScopeName: string
  canUseLocalSourceScope: boolean
  wrapperChildColumnIndex: number
  childFieldName: string
  childQuery: QueryPlanDbQuery
  childColumnIndex: number
  childScopeName: string
  canUseLocalChildScope: boolean
  writeChild: RawNestedFinalOwnerRowWriter
}

type RawNestedFinalOwnerChildListRelation = {
  fieldName: string
  query: QueryPlanDbQuery
  parentColumnIndex: number
  childColumnIndex: number
  scopeName: string
  canUseLocalScope: boolean
  writeChild: RawNestedFinalOwnerRowWriter
  uniqueRelationFieldName: string
  uniqueRelationQuery: QueryPlanDbQuery
  uniqueRelationParentColumnIndex: number
  uniqueRelationChildColumnIndex: number
  uniqueRelationScopeName: string
  canUseLocalUniqueRelationScope: boolean
  writeUniqueRelationChild: RawNestedFinalOwnerRowWriter
}

type RawNestedFinalOwnerChildTarget = {
  id: unknown
  record: PrismaObject
}

function tryCompileRawNestedFinalOwnerProgram(query: RawNestedReadQuery): RawNestedFinalOwnerProgram | undefined {
  const writeRoot = tryCompileRawNestedFinalOwnerRowWriter(query[1])
  const relations = query[2]
  if (writeRoot === undefined || relations?.length !== 4) {
    return undefined
  }

  const uniqueRelations: RawNestedFinalOwnerUniqueRelation[] = []
  let wrapperListRelation: RawNestedFinalOwnerWrapperListRelation | undefined
  let childListRelation: RawNestedFinalOwnerChildListRelation | undefined

  for (let i = 0; i < relations.length; i++) {
    const relation = relations[i]
    if (relation[0] !== 'r') {
      return undefined
    }

    if (relation[6]) {
      const uniqueRelation = tryCompileRawNestedFinalOwnerUniqueRelation(relation)
      if (uniqueRelation === undefined) {
        return undefined
      }
      uniqueRelations.push(uniqueRelation)
      continue
    }

    const wrapperRelation = tryCompileRawNestedFinalOwnerWrapperListRelation(relation)
    if (wrapperRelation !== undefined) {
      if (wrapperListRelation !== undefined) {
        return undefined
      }
      wrapperListRelation = wrapperRelation
      continue
    }

    const listRelation = tryCompileRawNestedFinalOwnerChildListRelation(relation)
    if (listRelation === undefined || childListRelation !== undefined) {
      return undefined
    }
    childListRelation = listRelation
  }

  if (
    uniqueRelations.length !== 2 ||
    wrapperListRelation === undefined ||
    childListRelation === undefined ||
    wrapperListRelation.sourceParentColumnIndex !== childListRelation.parentColumnIndex
  ) {
    return undefined
  }

  return {
    rootQuery: query[0],
    rootKeyColumnIndex: wrapperListRelation.sourceParentColumnIndex,
    writeRoot,
    uniqueRelations: [uniqueRelations[0], uniqueRelations[1]],
    wrapperListRelation,
    childListRelation,
  }
}

function tryCompileRawNestedFinalOwnerUniqueRelation(
  relation: RawNestedReadDirectRelation,
): RawNestedFinalOwnerUniqueRelation | undefined {
  const childQuery = relation[2]
  if (
    childQuery[2] !== undefined ||
    !rawNestedReadQueryCanUseLocalScopes(childQuery, relation[5]) ||
    typeof relation[3] !== 'number' ||
    typeof relation[4] !== 'number'
  ) {
    return undefined
  }

  const writeChild = tryCompileRawNestedFinalOwnerRowWriter(childQuery[1])
  if (writeChild === undefined) {
    return undefined
  }

  return {
    fieldName: relation[1],
    query: childQuery[0],
    parentColumnIndex: relation[3],
    childColumnIndex: relation[4],
    scopeName: relation[5],
    canUseLocalScope: true,
    writeChild,
  }
}

function tryCompileRawNestedFinalOwnerWrapperListRelation(
  relation: RawNestedReadDirectRelation,
): RawNestedFinalOwnerWrapperListRelation | undefined {
  const sourceQuery = relation[2]
  const nestedRelations = sourceQuery[2]
  if (
    sourceQuery[1].length !== 0 ||
    nestedRelations?.length !== 1 ||
    !rawNestedReadQueryCanUseLocalScopes(sourceQuery, relation[5]) ||
    typeof relation[3] !== 'number' ||
    typeof relation[4] !== 'number'
  ) {
    return undefined
  }

  const childRelation = nestedRelations[0]
  if (
    childRelation[0] !== 'r' ||
    !childRelation[6] ||
    childRelation[2][2] !== undefined ||
    !rawNestedReadQueryCanUseLocalScopes(childRelation[2], childRelation[5]) ||
    typeof childRelation[3] !== 'number' ||
    typeof childRelation[4] !== 'number'
  ) {
    return undefined
  }

  const writeChild = tryCompileRawNestedFinalOwnerRowWriter(childRelation[2][1])
  if (writeChild === undefined) {
    return undefined
  }

  return {
    fieldName: relation[1],
    sourceQuery: sourceQuery[0],
    sourceParentColumnIndex: relation[3],
    sourceChildColumnIndex: relation[4],
    sourceScopeName: relation[5],
    canUseLocalSourceScope: true,
    wrapperChildColumnIndex: childRelation[3],
    childFieldName: childRelation[1],
    childQuery: childRelation[2][0],
    childColumnIndex: childRelation[4],
    childScopeName: childRelation[5],
    canUseLocalChildScope: true,
    writeChild,
  }
}

function tryCompileRawNestedFinalOwnerChildListRelation(
  relation: RawNestedReadDirectRelation,
): RawNestedFinalOwnerChildListRelation | undefined {
  const childQuery = relation[2]
  const nestedRelations = childQuery[2]
  if (
    nestedRelations?.length !== 1 ||
    !rawNestedReadQueryCanUseLocalScopes(childQuery, relation[5]) ||
    typeof relation[3] !== 'number' ||
    typeof relation[4] !== 'number'
  ) {
    return undefined
  }

  const writeChild = tryCompileRawNestedFinalOwnerRowWriter(childQuery[1])
  if (writeChild === undefined) {
    return undefined
  }

  const uniqueRelation = nestedRelations[0]
  if (
    uniqueRelation[0] !== 'r' ||
    !uniqueRelation[6] ||
    uniqueRelation[2][2] !== undefined ||
    !rawNestedReadQueryCanUseLocalScopes(uniqueRelation[2], uniqueRelation[5]) ||
    typeof uniqueRelation[3] !== 'number' ||
    typeof uniqueRelation[4] !== 'number'
  ) {
    return undefined
  }

  const writeUniqueRelationChild = tryCompileRawNestedFinalOwnerRowWriter(uniqueRelation[2][1])
  if (writeUniqueRelationChild === undefined) {
    return undefined
  }

  return {
    fieldName: relation[1],
    query: childQuery[0],
    parentColumnIndex: relation[3],
    childColumnIndex: relation[4],
    scopeName: relation[5],
    canUseLocalScope: true,
    writeChild,
    uniqueRelationFieldName: uniqueRelation[1],
    uniqueRelationQuery: uniqueRelation[2][0],
    uniqueRelationParentColumnIndex: uniqueRelation[3],
    uniqueRelationChildColumnIndex: uniqueRelation[4],
    uniqueRelationScopeName: uniqueRelation[5],
    canUseLocalUniqueRelationScope: true,
    writeUniqueRelationChild,
  }
}

function tryCompileRawNestedFinalOwnerRowWriter(
  mappings: readonly RawResultColumnMapping[],
): RawNestedFinalOwnerRowWriter | undefined {
  const fieldNameOrPaths = new Array<string | readonly string[]>(mappings.length)
  const columnIndexes = new Array<number>(mappings.length)
  const columnNames = new Array<string>(mappings.length)
  const fieldTypes = new Array<FieldType | undefined>(mappings.length)
  const convertKinds = new Array<RawNestedConvertKind>(mappings.length)

  for (let i = 0; i < mappings.length; i++) {
    const mapping = mappings[i]
    if (typeof mapping[1] !== 'number') {
      return undefined
    }

    const fieldType = mapping[2]
    const convertKind = getRawNestedConvertKind(fieldType)
    if (convertKind === RAW_NESTED_CONVERT_FULL) {
      return undefined
    }

    fieldNameOrPaths[i] = mapping[0]
    columnIndexes[i] = mapping[1]
    columnNames[i] = getRawNestedMappingName(mapping[0])
    fieldTypes[i] = fieldType
    convertKinds[i] = convertKind
  }

  return (row) => {
    const record: PrismaObject = {}
    for (let i = 0; i < fieldNameOrPaths.length; i++) {
      const value = mapRawNestedFieldValue(
        row[columnIndexes[i]],
        columnNames[i],
        fieldTypes[i],
        convertKinds[i],
        EMPTY_ENUMS,
        'js',
      )
      const fieldNameOrPath = fieldNameOrPaths[i]
      if (typeof fieldNameOrPath === 'string') {
        record[fieldNameOrPath] = value
      } else {
        setRawNestedPath(record, fieldNameOrPath, value)
      }
    }
    return record
  }
}

function mapRawNestedFirstFinalOwnerChild(
  rows: readonly unknown[][],
  childColumnIndex: number,
  parentKey: unknown,
  writeChild: RawNestedFinalOwnerRowWriter,
): PrismaObject | null {
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][childColumnIndex] === parentKey) {
      return writeChild(rows[i])
    }
  }
  return null
}

function mapRawNestedFinalOwnerWrapperList(
  rootKey: unknown,
  relation: RawNestedFinalOwnerWrapperListRelation,
  wrapperRows: readonly unknown[][],
  childRows: readonly unknown[][],
): PrismaObject[] {
  const records: PrismaObject[] = []
  for (let i = 0; i < wrapperRows.length; i++) {
    const wrapperRow = wrapperRows[i]
    if (wrapperRow[relation.sourceChildColumnIndex] !== rootKey) {
      continue
    }

    const record: PrismaObject = {}
    record[relation.childFieldName] = mapRawNestedFirstFinalOwnerChild(
      childRows,
      relation.childColumnIndex,
      wrapperRow[relation.wrapperChildColumnIndex],
      relation.writeChild,
    )
    records.push(record)
  }
  return records
}

function attachRawNestedFinalOwnerUniqueChildren(
  targets: readonly RawNestedFinalOwnerChildTarget[],
  relation: RawNestedFinalOwnerChildListRelation,
  rows: readonly unknown[][],
): void {
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i]
    target.record[relation.uniqueRelationFieldName] = mapRawNestedFirstFinalOwnerChild(
      rows,
      relation.uniqueRelationChildColumnIndex,
      target.id,
      relation.writeUniqueRelationChild,
    )
  }
}

function compileRawNestedReadRelations(
  relations: readonly CompiledRawNestedReadRelation[],
): CompiledRawNestedReadRelations | undefined {
  switch (relations.length) {
    case 0:
      return undefined
    case 1:
      return relations[0]
    case 2: {
      const relation0 = relations[0]
      const relation1 = relations[1]
      return async (parentResult, context, scope) => {
        await Promise.all([relation0(parentResult, context, scope), relation1(parentResult, context, scope)])
      }
    }
    case 3: {
      const relation0 = relations[0]
      const relation1 = relations[1]
      const relation2 = relations[2]
      return async (parentResult, context, scope) => {
        await Promise.all([
          relation0(parentResult, context, scope),
          relation1(parentResult, context, scope),
          relation2(parentResult, context, scope),
        ])
      }
    }
    case 4: {
      const relation0 = relations[0]
      const relation1 = relations[1]
      const relation2 = relations[2]
      const relation3 = relations[3]
      return async (parentResult, context, scope) => {
        await Promise.all([
          relation0(parentResult, context, scope),
          relation1(parentResult, context, scope),
          relation2(parentResult, context, scope),
          relation3(parentResult, context, scope),
        ])
      }
    }
    default:
      return async (parentResult, context, scope) => {
        const promises = new Array<Promise<void>>(relations.length)
        for (let i = 0; i < relations.length; i++) {
          promises[i] = relations[i](parentResult, context, scope)
        }
        await Promise.all(promises)
      }
  }
}

function compileRawNestedRowMapper(
  mappings: readonly RawResultColumnMapping[],
  enums: Record<string, Record<string, string>>,
  resultFormat: QueryResultFormat,
): CompiledRawNestedRowMapper {
  if (!canUseDirectRawNestedRowMapper(mappings)) {
    return (resultSet) => mapRawNestedRows(resultSet, mappings, enums, resultFormat)
  }

  const fieldNames = new Array<string>(mappings.length)
  const columnIndexes = new Array<number>(mappings.length)
  for (let i = 0; i < mappings.length; i++) {
    fieldNames[i] = mappings[i][0] as string
    columnIndexes[i] = mappings[i][1] as number
  }

  return (resultSet) => {
    const rows = resultSet.rows
    if (rows.length === 0) {
      return []
    }

    const result = new Array<PrismaObject>(rows.length)
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex]
      const record: PrismaObject = {}
      for (let mappingIndex = 0; mappingIndex < fieldNames.length; mappingIndex++) {
        record[fieldNames[mappingIndex]] = row[columnIndexes[mappingIndex]]
      }
      result[rowIndex] = record
    }
    return result
  }
}

function canUseDirectRawNestedRowMapper(mappings: readonly RawResultColumnMapping[]): boolean {
  for (let i = 0; i < mappings.length; i++) {
    const mapping = mappings[i]
    if (typeof mapping[0] !== 'string' || typeof mapping[1] !== 'number' || mapping[2] !== undefined) {
      return false
    }
  }
  return true
}

function mapRawNestedRows(
  resultSet: SqlResultSet,
  mappings: readonly RawResultColumnMapping[],
  enums: Record<string, Record<string, string>>,
  resultFormat: QueryResultFormat,
): PrismaObject[] {
  const rows = resultSet.rows
  if (rows.length === 0) {
    return []
  }

  const resolvedMappings = resolveRawResultColumnMappings(resultSet.columnNames, mappings)
  const result = new Array<PrismaObject>(rows.length)
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]
    const record: PrismaObject = {}
    for (let mappingIndex = 0; mappingIndex < resolvedMappings.length; mappingIndex++) {
      const mapping = resolvedMappings[mappingIndex]
      const fieldNameOrPath = mapping[0]
      const columnIndex = mapping[1]
      const columnName = mapping[2]
      const fieldType = mapping[3]
      const convertKind = mapping[4]
      const value = row[columnIndex]
      const mappedValue = mapRawNestedFieldValue(value, columnName, fieldType, convertKind, enums, resultFormat)
      if (typeof fieldNameOrPath === 'string') {
        record[fieldNameOrPath] = mappedValue
      } else {
        setRawNestedPath(record, fieldNameOrPath, mappedValue)
      }
    }
    result[rowIndex] = record
  }
  return result
}

function getRawNestedUniqueWrapperRelation(
  mappings: readonly RawResultColumnMapping[],
  relations: readonly RawNestedReadRelation[] | undefined,
): RawNestedReadDirectRelation | undefined {
  if (mappings.length !== 0 || relations?.length !== 1) {
    return undefined
  }

  const relation = relations[0]
  if (relation[0] !== 'r' || !relation[6]) {
    return undefined
  }

  return relation
}

function createRawNestedRelationScope(
  parentScope: Record<string, unknown>,
  name: string,
  value: unknown,
  canUseLocalScope: boolean,
): Record<string, unknown> {
  const scope = canUseLocalScope ? {} : (Object.create(parentScope) as Record<string, unknown>)
  scope[name] = value
  return scope
}

function rawNestedReadQueryCanUseLocalScopes(query: RawNestedReadQuery, scopeName: string): boolean {
  if (!rawNestedDbQueryUsesOnlyScopeName(query[0], scopeName)) {
    return false
  }

  const relations = query[2]
  if (relations === undefined) {
    return true
  }

  for (let i = 0; i < relations.length; i++) {
    const relation = relations[i]
    if (!rawNestedReadQueryCanUseLocalScopes(relation[2], relation[5])) {
      return false
    }
  }

  return true
}

function rawNestedDbQueryUsesOnlyScopeName(dbQuery: QueryPlanDbQuery, scopeName: string): boolean {
  if (Array.isArray(dbQuery)) {
    return rawNestedValueUsesOnlyScopeName(dbQuery[2], scopeName)
  }

  return rawNestedValueUsesOnlyScopeName((dbQuery as { args: readonly unknown[] }).args, scopeName)
}

function rawNestedValueUsesOnlyScopeName(value: unknown, scopeName: string): boolean {
  if (isPrismaValuePlaceholder(value)) {
    return getPrismaValuePlaceholderName(value) === scopeName
  }

  if (isPrismaValueGenerator(value)) {
    return rawNestedValueUsesOnlyScopeName(getPrismaValueGeneratorArgs(value), scopeName)
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (!rawNestedValueUsesOnlyScopeName(value[i], scopeName)) {
        return false
      }
    }
    return true
  }

  if (typeof value === 'object' && value !== null) {
    for (const key of Object.keys(value)) {
      if (!rawNestedValueUsesOnlyScopeName((value as Record<string, unknown>)[key], scopeName)) {
        return false
      }
    }
  }

  return true
}

const RAW_NESTED_CONVERT_NONE = 0
const RAW_NESTED_CONVERT_STRING = 1
const RAW_NESTED_CONVERT_INT = 2
const RAW_NESTED_CONVERT_FLOAT = 3
const RAW_NESTED_CONVERT_BOOLEAN = 4
const RAW_NESTED_CONVERT_UNSUPPORTED = 5
const RAW_NESTED_CONVERT_DATE_JS = 6
const RAW_NESTED_CONVERT_FULL = 7
const RAW_NESTED_INDEX_THRESHOLD = 8

type RawNestedConvertKind =
  | typeof RAW_NESTED_CONVERT_NONE
  | typeof RAW_NESTED_CONVERT_STRING
  | typeof RAW_NESTED_CONVERT_INT
  | typeof RAW_NESTED_CONVERT_FLOAT
  | typeof RAW_NESTED_CONVERT_BOOLEAN
  | typeof RAW_NESTED_CONVERT_UNSUPPORTED
  | typeof RAW_NESTED_CONVERT_DATE_JS
  | typeof RAW_NESTED_CONVERT_FULL

type ResolvedRawResultColumnMapping = readonly [
  fieldName: string | readonly string[],
  columnIndex: number,
  columnName: string,
  fieldType?: FieldType,
  convertKind?: RawNestedConvertKind,
]

function resolveRawResultColumnMappings(
  columnNames: readonly string[],
  mappings: readonly RawResultColumnMapping[],
): ResolvedRawResultColumnMapping[] {
  const cachedNumericMappings = rawResultNumericColumnMappingsCache.get(mappings)
  if (cachedNumericMappings !== undefined) {
    return cachedNumericMappings
  }

  if (usesOnlyNumericRawResultColumnRefs(mappings)) {
    const resolvedMappings = new Array<ResolvedRawResultColumnMapping>(mappings.length)
    for (let i = 0; i < mappings.length; i++) {
      const mapping = mappings[i]
      const fieldType = mapping[2]
      resolvedMappings[i] = [
        mapping[0],
        mapping[1] as number,
        getRawNestedMappingName(mapping[0]),
        fieldType,
        getRawNestedConvertKind(fieldType),
      ]
    }
    rawResultNumericColumnMappingsCache.set(mappings, resolvedMappings)
    return resolvedMappings
  }

  let mappingsByColumnNames = rawResultColumnMappingsCache.get(mappings)
  if (mappingsByColumnNames === undefined) {
    mappingsByColumnNames = new WeakMap<readonly string[], ResolvedRawResultColumnMapping[]>()
    rawResultColumnMappingsCache.set(mappings, mappingsByColumnNames)
  }

  const cached = mappingsByColumnNames.get(columnNames)
  if (cached !== undefined) {
    return cached
  }

  const resolvedMappings = new Array<ResolvedRawResultColumnMapping>(mappings.length)
  for (let i = 0; i < mappings.length; i++) {
    const mapping = mappings[i]
    const fieldType = mapping[2]
    resolvedMappings[i] = [
      mapping[0],
      resolveRawResultColumnRef(columnNames, mapping[1]),
      typeof mapping[1] === 'string' ? mapping[1] : getRawNestedMappingName(mapping[0]),
      fieldType,
      getRawNestedConvertKind(fieldType),
    ]
  }
  mappingsByColumnNames.set(columnNames, resolvedMappings)
  return resolvedMappings
}

function usesOnlyNumericRawResultColumnRefs(mappings: readonly RawResultColumnMapping[]): boolean {
  for (let i = 0; i < mappings.length; i++) {
    if (typeof mappings[i][1] !== 'number') {
      return false
    }
  }
  return true
}

function getRawNestedConvertKind(fieldType: FieldType | undefined): RawNestedConvertKind {
  switch (fieldType) {
    case undefined:
      return RAW_NESTED_CONVERT_NONE
    case 's':
    case 'string':
      return RAW_NESTED_CONVERT_STRING
    case 'i':
    case 'int':
      return RAW_NESTED_CONVERT_INT
    case 'f':
    case 'float':
      return RAW_NESTED_CONVERT_FLOAT
    case 'b':
    case 'boolean':
      return RAW_NESTED_CONVERT_BOOLEAN
    case 'x':
    case 'unsupported':
      return RAW_NESTED_CONVERT_UNSUPPORTED
    case 'D':
    case 'datetime':
      return RAW_NESTED_CONVERT_DATE_JS
    default:
      return RAW_NESTED_CONVERT_FULL
  }
}

function resolveRawResultColumnRef(columnNames: readonly string[], column: RawResultColumnRef): number {
  if (typeof column === 'number') {
    return column
  }

  const columnIndexes = getRawResultColumnIndexes(columnNames)
  const columnIndex = columnIndexes[column]
  if (columnIndex !== undefined) {
    return columnIndex
  }

  throw new Error(`Missing raw nested read column '${column}' in result columns: ${columnNames.join(', ')}`)
}

function getRawResultColumnIndexes(columnNames: readonly string[]): Record<string, number> {
  let columnIndexes = rawResultColumnIndexesCache.get(columnNames)
  if (columnIndexes !== undefined) {
    return columnIndexes
  }

  columnIndexes = Object.create(null) as Record<string, number>
  for (let i = 0; i < columnNames.length; i++) {
    columnIndexes[columnNames[i]] = i
  }
  rawResultColumnIndexesCache.set(columnNames, columnIndexes)
  return columnIndexes
}

function mapRawNestedFieldValue(
  value: unknown,
  columnName: string,
  fieldType: FieldType | undefined,
  convertKind: RawNestedConvertKind | undefined,
  enums: Record<string, Record<string, string>>,
  resultFormat: QueryResultFormat,
): unknown {
  if (fieldType === undefined) {
    return value
  }

  if (value === null && typeof fieldType === 'string') {
    return null
  }

  switch (convertKind) {
    case RAW_NESTED_CONVERT_STRING:
      if (typeof value === 'string') {
        return value
      }
      break

    case RAW_NESTED_CONVERT_INT:
      if (typeof value === 'number') {
        return Math.trunc(value)
      }
      break

    case RAW_NESTED_CONVERT_FLOAT:
      if (typeof value === 'number') {
        return value
      }
      break

    case RAW_NESTED_CONVERT_BOOLEAN:
      if (typeof value === 'boolean') {
        return value
      }
      break

    case RAW_NESTED_CONVERT_UNSUPPORTED:
      return value

    case RAW_NESTED_CONVERT_DATE_JS:
      if (resultFormat === 'js' && value instanceof Date) {
        return new Date(value)
      }
      break
  }

  return mapRawFieldValue(value, columnName, fieldType, enums, resultFormat)
}

function getRawNestedMappingName(fieldNameOrPath: string | readonly string[]): string {
  return typeof fieldNameOrPath === 'string' ? fieldNameOrPath : fieldNameOrPath.join('.')
}

function setRawNestedPath(record: PrismaObject, path: readonly string[], value: unknown): void {
  let target = record
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i]
    const next = target[segment]
    if (typeof next === 'object' && next !== null && !Array.isArray(next)) {
      target = next as PrismaObject
    } else {
      const child: PrismaObject = {}
      target[segment] = child
      target = child
    }
  }

  target[path[path.length - 1]] = value
}

function getRawNestedScopeValue(rows: readonly unknown[][], columnIndex: number): unknown {
  if (rows.length === 0) {
    return []
  }
  if (rows.length === 1) {
    return rows[0][columnIndex]
  }

  const values: unknown[] = []
  const seen = new Set<unknown>()
  for (let i = 0; i < rows.length; i++) {
    const value = rows[i][columnIndex]
    if (!seen.has(value)) {
      seen.add(value)
      values.push(value)
    }
  }
  return values
}

function attachRawNestedDirectRelation(
  parentRows: readonly unknown[][],
  parentRecords: readonly PrismaObject[],
  relation: RawNestedReadDirectRelation,
  parentColumnIndex: number,
  childRows: readonly unknown[][],
  childRecords: readonly PrismaObject[],
  childColumnIndex: number,
): void {
  attachRawNestedDirectRelationByIndex(
    parentRows,
    parentRecords,
    relation[1],
    relation[6],
    parentColumnIndex,
    childRows,
    childRecords,
    childColumnIndex,
  )
}

function attachRawNestedDirectRelationByIndex(
  parentRows: readonly unknown[][],
  parentRecords: readonly PrismaObject[],
  fieldName: string,
  isRelationUnique: boolean,
  parentColumnIndex: number,
  childRows: readonly unknown[][],
  childRecords: readonly PrismaObject[],
  childColumnIndex: number,
): void {
  if (parentRows.length + childRows.length >= RAW_NESTED_INDEX_THRESHOLD) {
    attachIndexedRawNestedDirectRelation(
      parentRows,
      parentRecords,
      fieldName,
      isRelationUnique,
      parentColumnIndex,
      childRows,
      childRecords,
      childColumnIndex,
    )
    return
  }

  for (let parentIndex = 0; parentIndex < parentRecords.length; parentIndex++) {
    const parentKey = parentRows[parentIndex][parentColumnIndex]
    if (isRelationUnique) {
      parentRecords[parentIndex][fieldName] = findRawNestedChild(parentKey, childRows, childRecords, childColumnIndex)
      continue
    }

    const children: PrismaObject[] = []
    for (let childIndex = 0; childIndex < childRows.length; childIndex++) {
      if (childRows[childIndex][childColumnIndex] === parentKey) {
        children.push(childRecords[childIndex])
      }
    }
    parentRecords[parentIndex][fieldName] = children
  }
}

function attachEmptyRawNestedDirectRelation(
  parentRecords: readonly PrismaObject[],
  fieldName: string,
  isRelationUnique: boolean,
): void {
  for (let parentIndex = 0; parentIndex < parentRecords.length; parentIndex++) {
    parentRecords[parentIndex][fieldName] = isRelationUnique ? null : []
  }
}

function attachRawNestedDirectUniqueWrapperRelationByIndex(
  parentRows: readonly unknown[][],
  parentRecords: readonly PrismaObject[],
  fieldName: string,
  isRelationUnique: boolean,
  parentColumnIndex: number,
  wrapperRows: readonly unknown[][],
  wrapperParentColumnIndex: number,
  wrapperChildColumnIndex: number,
  wrapperFieldName: string,
  childRows: readonly unknown[][],
  childRecords: readonly PrismaObject[],
  childColumnIndex: number,
): void {
  if (parentRows.length + wrapperRows.length + childRows.length >= RAW_NESTED_INDEX_THRESHOLD) {
    attachIndexedRawNestedDirectUniqueWrapperRelation(
      parentRows,
      parentRecords,
      fieldName,
      isRelationUnique,
      parentColumnIndex,
      wrapperRows,
      wrapperParentColumnIndex,
      wrapperChildColumnIndex,
      wrapperFieldName,
      childRows,
      childRecords,
      childColumnIndex,
    )
    return
  }

  for (let parentIndex = 0; parentIndex < parentRecords.length; parentIndex++) {
    const parentKey = parentRows[parentIndex][parentColumnIndex]
    if (isRelationUnique) {
      parentRecords[parentIndex][fieldName] = findRawNestedUniqueWrapperChild(
        parentKey,
        wrapperRows,
        wrapperParentColumnIndex,
        wrapperChildColumnIndex,
        wrapperFieldName,
        childRows,
        childRecords,
        childColumnIndex,
      )
      continue
    }

    const children: PrismaObject[] = []
    for (let wrapperIndex = 0; wrapperIndex < wrapperRows.length; wrapperIndex++) {
      const wrapperRow = wrapperRows[wrapperIndex]
      if (wrapperRow[wrapperParentColumnIndex] === parentKey) {
        children.push(
          createRawNestedUniqueWrapperRecord(
            wrapperFieldName,
            wrapperRow[wrapperChildColumnIndex],
            childRows,
            childRecords,
            childColumnIndex,
          ),
        )
      }
    }
    parentRecords[parentIndex][fieldName] = children
  }
}

function attachIndexedRawNestedDirectUniqueWrapperRelation(
  parentRows: readonly unknown[][],
  parentRecords: readonly PrismaObject[],
  fieldName: string,
  isRelationUnique: boolean,
  parentColumnIndex: number,
  wrapperRows: readonly unknown[][],
  wrapperParentColumnIndex: number,
  wrapperChildColumnIndex: number,
  wrapperFieldName: string,
  childRows: readonly unknown[][],
  childRecords: readonly PrismaObject[],
  childColumnIndex: number,
): void {
  const childByKey = new Map<unknown, PrismaObject>()
  for (let childIndex = 0; childIndex < childRows.length; childIndex++) {
    const childKey = childRows[childIndex][childColumnIndex]
    if (!childByKey.has(childKey)) {
      childByKey.set(childKey, childRecords[childIndex])
    }
  }

  if (isRelationUnique) {
    const wrapperByParentKey = new Map<unknown, PrismaObject>()
    for (let wrapperIndex = 0; wrapperIndex < wrapperRows.length; wrapperIndex++) {
      const wrapperRow = wrapperRows[wrapperIndex]
      const parentKey = wrapperRow[wrapperParentColumnIndex]
      if (!wrapperByParentKey.has(parentKey)) {
        const wrapperRecord: PrismaObject = {}
        wrapperRecord[wrapperFieldName] = childByKey.get(wrapperRow[wrapperChildColumnIndex]) ?? null
        wrapperByParentKey.set(parentKey, wrapperRecord)
      }
    }

    for (let parentIndex = 0; parentIndex < parentRecords.length; parentIndex++) {
      parentRecords[parentIndex][fieldName] = wrapperByParentKey.get(parentRows[parentIndex][parentColumnIndex]) ?? null
    }
    return
  }

  const wrappersByParentKey = new Map<unknown, PrismaObject[]>()
  for (let wrapperIndex = 0; wrapperIndex < wrapperRows.length; wrapperIndex++) {
    const wrapperRow = wrapperRows[wrapperIndex]
    const parentKey = wrapperRow[wrapperParentColumnIndex]
    let wrappers = wrappersByParentKey.get(parentKey)
    if (wrappers === undefined) {
      wrappers = []
      wrappersByParentKey.set(parentKey, wrappers)
    }

    const wrapperRecord: PrismaObject = {}
    wrapperRecord[wrapperFieldName] = childByKey.get(wrapperRow[wrapperChildColumnIndex]) ?? null
    wrappers.push(wrapperRecord)
  }

  for (let parentIndex = 0; parentIndex < parentRecords.length; parentIndex++) {
    parentRecords[parentIndex][fieldName] =
      wrappersByParentKey.get(parentRows[parentIndex][parentColumnIndex])?.slice() ?? []
  }
}

function findRawNestedUniqueWrapperChild(
  parentKey: unknown,
  wrapperRows: readonly unknown[][],
  wrapperParentColumnIndex: number,
  wrapperChildColumnIndex: number,
  wrapperFieldName: string,
  childRows: readonly unknown[][],
  childRecords: readonly PrismaObject[],
  childColumnIndex: number,
): PrismaObject | null {
  for (let wrapperIndex = 0; wrapperIndex < wrapperRows.length; wrapperIndex++) {
    const wrapperRow = wrapperRows[wrapperIndex]
    if (wrapperRow[wrapperParentColumnIndex] === parentKey) {
      return createRawNestedUniqueWrapperRecord(
        wrapperFieldName,
        wrapperRow[wrapperChildColumnIndex],
        childRows,
        childRecords,
        childColumnIndex,
      )
    }
  }
  return null
}

function createRawNestedUniqueWrapperRecord(
  fieldName: string,
  childKey: unknown,
  childRows: readonly unknown[][],
  childRecords: readonly PrismaObject[],
  childColumnIndex: number,
): PrismaObject {
  const record: PrismaObject = {}
  record[fieldName] = findRawNestedChild(childKey, childRows, childRecords, childColumnIndex)
  return record
}

function mapRawNestedUniqueWrapperRows(
  rows: readonly unknown[][],
  parentColumnIndex: number,
  fieldName: string,
  childRows: readonly unknown[][],
  childRecords: readonly PrismaObject[],
  childColumnIndex: number,
): PrismaObject[] {
  const records = new Array<PrismaObject>(rows.length)
  if (rows.length + childRows.length >= RAW_NESTED_INDEX_THRESHOLD) {
    const childByKey = new Map<unknown, PrismaObject>()
    for (let childIndex = 0; childIndex < childRows.length; childIndex++) {
      const childKey = childRows[childIndex][childColumnIndex]
      if (!childByKey.has(childKey)) {
        childByKey.set(childKey, childRecords[childIndex])
      }
    }

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const record: PrismaObject = {}
      record[fieldName] = childByKey.get(rows[rowIndex][parentColumnIndex]) ?? null
      records[rowIndex] = record
    }
    return records
  }

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const record: PrismaObject = {}
    record[fieldName] = findRawNestedChild(rows[rowIndex][parentColumnIndex], childRows, childRecords, childColumnIndex)
    records[rowIndex] = record
  }
  return records
}

function attachIndexedRawNestedDirectRelation(
  parentRows: readonly unknown[][],
  parentRecords: readonly PrismaObject[],
  fieldName: string,
  isRelationUnique: boolean,
  parentColumnIndex: number,
  childRows: readonly unknown[][],
  childRecords: readonly PrismaObject[],
  childColumnIndex: number,
): void {
  if (isRelationUnique) {
    const childByKey = new Map<unknown, PrismaObject>()
    for (let childIndex = 0; childIndex < childRows.length; childIndex++) {
      const childKey = childRows[childIndex][childColumnIndex]
      if (!childByKey.has(childKey)) {
        childByKey.set(childKey, childRecords[childIndex])
      }
    }

    for (let parentIndex = 0; parentIndex < parentRecords.length; parentIndex++) {
      parentRecords[parentIndex][fieldName] = childByKey.get(parentRows[parentIndex][parentColumnIndex]) ?? null
    }
    return
  }

  const childrenByKey = new Map<unknown, PrismaObject[]>()
  for (let childIndex = 0; childIndex < childRows.length; childIndex++) {
    const childKey = childRows[childIndex][childColumnIndex]
    let children = childrenByKey.get(childKey)
    if (children === undefined) {
      children = []
      childrenByKey.set(childKey, children)
    }
    children.push(childRecords[childIndex])
  }

  for (let parentIndex = 0; parentIndex < parentRecords.length; parentIndex++) {
    parentRecords[parentIndex][fieldName] = childrenByKey.get(parentRows[parentIndex][parentColumnIndex])?.slice() ?? []
  }
}

function findRawNestedChild(
  parentKey: unknown,
  childRows: readonly unknown[][],
  childRecords: readonly PrismaObject[],
  childColumnIndex: number,
): PrismaObject | null {
  for (let childIndex = 0; childIndex < childRows.length; childIndex++) {
    if (childRows[childIndex][childColumnIndex] === parentKey) {
      return childRecords[childIndex]
    }
  }
  return null
}

function getMaxChunkSize(provider: SchemaProvider | undefined, connectionInfo: ConnectionInfo | undefined) {
  if (connectionInfo?.maxBindValues !== undefined) {
    return connectionInfo.maxBindValues
  }
  if (provider === undefined) {
    return undefined
  }

  switch (provider) {
    case 'cockroachdb':
    case 'postgres':
    case 'postgresql':
    case 'prisma+postgres':
      return 32766
    case 'mysql':
      return 65535
    case 'sqlite':
      return 999
    case 'sqlserver':
      return 2098
    case 'mongodb':
      return undefined
    default:
      assertNever(provider, `Unexpected provider: ${provider}`)
  }
}

type IntermediateValue = { value: Value; lastInsertId?: string }

type CompactMappedJoin = {
  parentName: string
  parentExpr: QueryPlanNode
  mappedBindings: { name: string; field: string }[]
  joinExpressions: CompactJoinExpression[]
  canAssumeStrictEquality: boolean
}

function matchCompactMappedJoin(node: QueryPlanCompactNode): CompactMappedJoin | undefined {
  if (node[0] !== 'l' || node[1].length !== 1) {
    return undefined
  }

  const parentBinding = node[1][0]
  const parentName = parentBinding[0]
  const parentExpr = parentBinding[1]
  const innerLet = node[2]
  if (!Array.isArray(innerLet) || innerLet[0] !== 'l' || innerLet[1].length < 2) {
    return undefined
  }

  const innerBindings = innerLet[1] as QueryPlanBinding[]
  const mappedBindings = new Array<{ name: string; field: string }>(innerBindings.length)
  for (let i = 0; i < innerBindings.length; i++) {
    const binding = innerBindings[i]
    const mapExpr = binding[1]
    if (
      !Array.isArray(mapExpr) ||
      mapExpr[0] !== 'm' ||
      !Array.isArray(mapExpr[2]) ||
      mapExpr[2][0] !== 'g' ||
      mapExpr[2][1] !== parentName
    ) {
      return undefined
    }
    mappedBindings[i] = {
      name: binding[0],
      field: mapExpr[1],
    }
  }

  const join = innerLet[2]
  if (
    !Array.isArray(join) ||
    join[0] !== 'j' ||
    !Array.isArray(join[1]) ||
    join[1][0] !== 'g' ||
    join[1][1] !== parentName ||
    join[2].length < 2
  ) {
    return undefined
  }

  return {
    parentName,
    parentExpr,
    mappedBindings,
    joinExpressions: join[2] as CompactJoinExpression[],
    canAssumeStrictEquality: join[3],
  }
}

type CompactNestedSingleChildJoin = {
  parentName: string
  parentExpr: QueryPlanNode
  mappedName: string
  mappedField: string
  childExpr: QueryPlanNode
  joinExpr: CompactJoinExpression
  canAssumeStrictEquality: boolean
}

function matchCompactNestedSingleChildJoin(node: QueryPlanCompactNode): CompactNestedSingleChildJoin | undefined {
  if (node[0] !== 'l' || node[1].length !== 1) {
    return undefined
  }

  const parentBinding = node[1][0]
  const parentName = parentBinding[0]
  const parentExpr = parentBinding[1]
  const innerLet = node[2]
  if (!Array.isArray(innerLet) || innerLet[0] !== 'l' || innerLet[1].length !== 1) {
    return undefined
  }

  const mappedBinding = innerLet[1][0] as QueryPlanBinding
  const mappedName = mappedBinding[0]
  const mapExpr = mappedBinding[1]
  if (
    !Array.isArray(mapExpr) ||
    mapExpr[0] !== 'm' ||
    !Array.isArray(mapExpr[2]) ||
    mapExpr[2][0] !== 'g' ||
    mapExpr[2][1] !== parentName
  ) {
    return undefined
  }

  const join = innerLet[2]
  if (
    !Array.isArray(join) ||
    join[0] !== 'j' ||
    !Array.isArray(join[1]) ||
    join[1][0] !== 'g' ||
    join[1][1] !== parentName ||
    join[2].length !== 1
  ) {
    return undefined
  }

  const joinExpr = join[2][0] as CompactJoinExpression

  return {
    parentName,
    parentExpr,
    mappedName,
    mappedField: mapExpr[1],
    childExpr: joinExpr[0],
    joinExpr,
    canAssumeStrictEquality: join[3],
  }
}

const queryPlanUsesNowGeneratorCache = new WeakMap<object, boolean>()

function queryPlanUsesNowGenerator(queryPlan: object): boolean {
  const cached = queryPlanUsesNowGeneratorCache.get(queryPlan)
  if (cached !== undefined) {
    return cached
  }

  const result = containsNowGenerator(queryPlan, new Set<object>())
  queryPlanUsesNowGeneratorCache.set(queryPlan, result)
  return result
}

function containsNowGenerator(value: unknown, seen: Set<object>): boolean {
  if (isPrismaValueGenerator(value)) {
    if (getPrismaValueGeneratorName(value) === 'now') {
      return true
    }
    return containsNowGenerator(getPrismaValueGeneratorArgs(value), seen)
  }

  if (typeof value !== 'object' || value === null) {
    return false
  }

  if (seen.has(value)) {
    return false
  }
  seen.add(value)

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (containsNowGenerator(value[i], seen)) {
        return true
      }
    }
    return false
  }

  for (const key in value) {
    if (Object.hasOwn(value, key) && containsNowGenerator(value[key], seen)) {
      return true
    }
  }

  return false
}

function isEmpty(value: Value): boolean {
  if (Array.isArray(value)) {
    return value.length === 0
  }
  return value == null
}

function asList(value: Value): Value[] {
  return Array.isArray(value) ? value : [value]
}

function asNumber(value: Value): number {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string') {
    return Number(value)
  }

  throw new Error(`Expected number, got ${typeof value}`)
}

function asRecord(value: Value): PrismaObject {
  if (typeof value === 'object' && value !== null) {
    return value as PrismaObject
  }
  throw new Error(`Expected object, got ${typeof value}`)
}

function mapField(value: Value, field: string): Value {
  if (Array.isArray(value)) {
    const result = new Array<Value>(value.length)
    for (let i = 0; i < value.length; i++) {
      const item = value[i]
      if (Array.isArray(item)) {
        result[i] = mapField(item, field)
      } else if (typeof item === 'object' && item !== null) {
        result[i] = item[field] ?? null
      } else {
        result[i] = item
      }
    }
    return result
  }

  if (typeof value === 'object' && value !== null) {
    return value[field] ?? null
  }

  return value
}

type JoinExpressionWithRecords = {
  joinExpr: JoinExpression
  childRecords: Value
}

type KeyCast = (value: Value) => Value

function attachChildrenToParents(
  parentRecords: unknown,
  children: JoinExpressionWithRecords[],
  canAssumeStrictEquality: boolean,
) {
  for (const { joinExpr, childRecords } of children) {
    const on = joinExpr[1]
    const parentField = joinExpr[2]
    const isRelationUnique = joinExpr[3]

    const parentArray = Array.isArray(parentRecords) ? parentRecords : [parentRecords]
    const childArray = Array.isArray(childRecords) ? childRecords : [childRecords]

    if (canAssumeStrictEquality && on.length === 1) {
      const parentKey = on[0][0]
      const childKey = on[0][1]
      if (parentArray.length + childArray.length < 8) {
        attachSingleStrictKeyChildren(parentArray, childArray, parentKey, childKey, parentField, isRelationUnique)
        continue
      }
    }

    const parentKeys = new Array<string>(on.length)
    const childKeys = new Array<string>(on.length)
    for (let i = 0; i < on.length; i++) {
      parentKeys[i] = on[i][0]
      childKeys[i] = on[i][1]
    }
    const parentKey = parentKeys[0]
    const childKey = childKeys[0]

    const useSingleStrictKey =
      canAssumeStrictEquality && parentKeys.length === 1 && parentArray.length + childArray.length >= 8
    const parentMap = useSingleStrictKey ? (Object.create(null) as Record<string, PrismaObject[]>) : {}

    for (const parent of parentArray) {
      const parentRecord = asRecord(parent)
      const key = useSingleStrictKey
        ? getScalarRecordKey(parentRecord[parentKey])
        : getRecordKey(parentRecord, parentKeys)
      if (!parentMap[key]) {
        parentMap[key] = []
      }
      parentMap[key].push(parentRecord)

      if (isRelationUnique) {
        parentRecord[parentField] = null
      } else {
        parentRecord[parentField] = []
      }
    }

    const mappers = canAssumeStrictEquality ? undefined : inferKeyCasts(parentArray, parentKeys)
    for (const childRecord of childArray) {
      if (childRecord === null) {
        continue
      }

      const childRecordObject = asRecord(childRecord)
      const key = useSingleStrictKey
        ? getScalarRecordKey(childRecordObject[childKey])
        : getRecordKey(childRecordObject, childKeys, mappers)
      const matchingParents = parentMap[key]
      if (matchingParents === undefined) {
        continue
      }

      for (const parentRecord of matchingParents) {
        if (isRelationUnique) {
          parentRecord[parentField] = childRecord
        } else {
          const childList = parentRecord[parentField] as Value[]
          childList.push(childRecord)
        }
      }
    }
  }

  return parentRecords
}

function attachSingleStrictKeyChildren(
  parentArray: unknown[],
  childArray: unknown[],
  parentKey: string,
  childKey: string,
  parentField: string,
  isRelationUnique: boolean,
) {
  for (const parent of parentArray) {
    const parentRecord = asRecord(parent)
    if (isRelationUnique) {
      parentRecord[parentField] = null
    } else {
      parentRecord[parentField] = []
    }
  }

  for (const childRecord of childArray) {
    if (childRecord === null) {
      continue
    }

    const childRecordObject = asRecord(childRecord)
    const childKeyValue = childRecordObject[childKey]
    for (const parent of parentArray) {
      const parentRecord = asRecord(parent)
      if (parentRecord[parentKey] !== childKeyValue) {
        continue
      }

      if (isRelationUnique) {
        parentRecord[parentField] = childRecord
      } else {
        const childList = parentRecord[parentField] as Value[]
        childList.push(childRecord)
      }
    }
  }
}

function getScalarRecordKey(value: Value): string {
  switch (typeof value) {
    case 'string':
      return `s:${value.length}:${value}`
    case 'number':
      return `n:${value}`
    case 'boolean':
      return value ? 'b:1' : 'b:0'
    case 'bigint':
      return `i:${value}`
    case 'undefined':
      return 'u:'
    case 'object':
      return value === null ? '0:' : `o:${JSON.stringify(value)}`
    default:
      return JSON.stringify([value])
  }
}

function inferKeyCasts(rows: unknown[], keys: readonly string[]): KeyCast[] {
  function getKeyCast(type: string): KeyCast | undefined {
    switch (type) {
      case 'number':
        return Number
      case 'string':
        return String
      case 'boolean':
        return Boolean
      case 'bigint':
        return BigInt as KeyCast
      default:
        return
    }
  }

  const keyCasts: KeyCast[] = Array.from({ length: keys.length })
  let keysFound = 0
  for (const parent of rows) {
    const parentRecord = asRecord(parent)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      if (parentRecord[key] !== null && keyCasts[i] === undefined) {
        const keyCast = getKeyCast(typeof parentRecord[key])
        if (keyCast !== undefined) {
          keyCasts[i] = keyCast
        }
        keysFound++
      }
    }
    if (keysFound === keys.length) {
      break
    }
  }

  return keyCasts
}

function evalFieldInitializer(
  initializer: DeepReadonly<FieldInitializer>,
  lastInsertId: string | undefined,
  scope: ScopeBindings,
  generators: GeneratorRegistrySnapshot,
): Value {
  switch (initializer.type) {
    case 'value':
      return evaluateArg(initializer.value, scope, generators)
    case 'lastInsertId':
      return lastInsertId
    default:
      assertNever(initializer, `Unexpected field initializer type: ${initializer['type']}`)
  }
}

function evalFieldOperation(
  op: DeepReadonly<FieldOperation>,
  value: Value,
  scope: ScopeBindings,
  generators: GeneratorRegistrySnapshot,
): Value {
  switch (op.type) {
    case 'set':
      return evaluateArg(op.value, scope, generators)
    case 'add':
      return asNumber(value) + asNumber(evaluateArg(op.value, scope, generators))
    case 'subtract':
      return asNumber(value) - asNumber(evaluateArg(op.value, scope, generators))
    case 'multiply':
      return asNumber(value) * asNumber(evaluateArg(op.value, scope, generators))
    case 'divide': {
      const lhs = asNumber(value)
      const rhs = asNumber(evaluateArg(op.value, scope, generators))
      // SQLite and older versions of MySQL return NULL for division by zero, so we emulate
      // that behavior here.
      // If the database does not permit division by zero, a database error should be raised,
      // preventing this case from being executed.
      if (rhs === 0) {
        return null
      }
      return lhs / rhs
    }
    default:
      assertNever(op, `Unexpected field operation type: ${op['type']}`)
  }
}

function applyComments(
  query: DeepReadonly<SqlQuery>,
  sqlCommenter?: QueryInterpreterSqlCommenter,
): DeepReadonly<SqlQuery> {
  if (!sqlCommenter || sqlCommenter.plugins.length === 0) {
    return query
  }

  const comment = buildSqlComment(sqlCommenter.plugins, {
    query: sqlCommenter.queryInfo,
    sql: query.sql,
  })

  if (!comment) {
    return query
  }

  return {
    ...query,
    sql: appendSqlComment(query.sql, comment),
  }
}

function evaluateProcessingParameters(
  ops: InMemoryOps,
  scope: ScopeBindings,
  generators: GeneratorRegistrySnapshot,
): void {
  const cursor = ops.pagination?.cursor
  if (cursor) {
    for (const [key, value] of Object.entries(cursor)) {
      cursor[key] = evaluateArg(value, scope, generators)
    }
  }
  for (const nested of Object.values(ops.nested ?? {})) {
    evaluateProcessingParameters(nested, scope, generators)
  }
}

function cloneObject<T>(value: T): DeepUnreadonly<T> {
  return klona(value) as DeepUnreadonly<T>
}

function asMutable<T>(value: DeepReadonly<T>): DeepUnreadonly<T> {
  return value as DeepUnreadonly<T>
}
