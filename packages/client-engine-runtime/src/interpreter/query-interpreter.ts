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
  getJoinExpressionChild,
  getJoinExpressionIsRelationUnique,
  getJoinExpressionOn,
  getJoinExpressionParentField,
  getPrismaValueGeneratorArgs,
  getPrismaValueGeneratorName,
  getQueryPlanBindingExpr,
  getQueryPlanBindingName,
  getValidationError,
  InMemoryOps,
  isPrismaValueGenerator,
  JoinExpression,
  type QueryPlanBinding,
  type QueryPlanCompactNode,
  QueryPlanDbQuery,
  type QueryPlanLegacyNode,
  QueryPlanNode,
  type QueryPlanRawSql,
  type RawNestedReadDirectRelation,
  type RawNestedReadManyToManyRelation,
  type RawNestedReadQuery,
  type RawNestedReadRelation,
  type RawResultColumnMapping,
  type RawResultColumnRef,
  type ResultNode,
  type ResultObjectNode,
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

const EMPTY_ENUMS: Record<string, Record<string, string>> = Object.freeze({})
const rawResultColumnIndexesCache = new WeakMap<readonly string[], Record<string, number>>()
const rawResultColumnMappingsCache = new WeakMap<
  readonly RawResultColumnMapping[],
  WeakMap<readonly string[], ResolvedRawResultColumnMapping[]>
>()

function isObjectResultNode(structure: ResultNode): structure is ResultObjectNode | CompactResultObjectNode {
  if (Array.isArray(structure)) {
    return true
  }
  return typeof structure === 'object' && 'type' in structure && structure.type === 'object'
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
    if (Array.isArray(queryNode)) {
      return this.#getCompiledCompactNode(queryNode as QueryPlanCompactNode)(context)
    }

    const node = queryNode as QueryPlanLegacyNode
    switch (node.type) {
      case 'value': {
        return {
          value: evaluateArg(node.args, context.scope, context.generators),
        }
      }

      case 'seq': {
        let result: IntermediateValue | undefined
        for (const arg of node.args) {
          result = await this.interpretNode(arg, context)
        }
        return result ?? { value: undefined }
      }

      case 'get': {
        return { value: context.scope[node.args.name] }
      }

      case 'let': {
        const nestedScope: ScopeBindings = Object.create(context.scope)
        const nestedContext = { ...context, scope: nestedScope }
        for (const binding of node.args.bindings) {
          const { value } = await this.interpretNode(getQueryPlanBindingExpr(binding), nestedContext)
          nestedScope[getQueryPlanBindingName(binding)] = value
        }
        return this.interpretNode(node.args.expr, nestedContext)
      }

      case 'getFirstNonEmpty': {
        for (const name of node.args.names) {
          const value = context.scope[name]
          if (!isEmpty(value)) {
            return { value }
          }
        }
        return { value: [] }
      }

      case 'concat': {
        const parts = await Promise.all(
          node.args.map((arg) => this.interpretNode(arg, context).then((res) => res.value)),
        )
        return {
          value: parts.length > 0 ? parts.reduce<Value[]>((acc, part) => acc.concat(asList(part)), []) : [],
        }
      }

      case 'sum': {
        const parts = await Promise.all(
          node.args.map((arg) => this.interpretNode(arg, context).then((res) => res.value)),
        )
        return {
          value: parts.length > 0 ? parts.reduce((acc, part) => asNumber(acc) + asNumber(part)) : 0,
        }
      }

      case 'execute': {
        const queries = renderQuery(node.args, context.scope, context.generators, this.#maxChunkSize)
        const isRaw = isRawSqlQuery(node.args)

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

      case 'query': {
        const queries = renderQuery(node.args, context.scope, context.generators, this.#maxChunkSize)
        const isRaw = isRawSqlQuery(node.args)

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

      case 'reverse': {
        const { value, lastInsertId } = await this.interpretNode(node.args, context)
        return { value: Array.isArray(value) ? value.reverse() : value, lastInsertId }
      }

      case 'unique': {
        const { value, lastInsertId } = await this.interpretNode(node.args, context)
        if (!Array.isArray(value)) {
          return { value, lastInsertId }
        }
        if (value.length > 1) {
          throw new Error(`Expected zero or one element, got ${value.length}`)
        }
        return { value: value[0] ?? null, lastInsertId }
      }

      case 'required': {
        const { value, lastInsertId } = await this.interpretNode(node.args, context)
        if (isEmpty(value)) {
          throw new Error('Required value is empty')
        }
        return { value, lastInsertId }
      }

      case 'mapField': {
        const { value, lastInsertId } = await this.interpretNode(node.args.records, context)
        return { value: mapField(value, node.args.field), lastInsertId }
      }

      case 'join': {
        const { value: parent, lastInsertId } = await this.interpretNode(node.args.parent, context)

        if (parent === null) {
          return { value: null, lastInsertId }
        }

        const children =
          node.args.children.length === 1
            ? [
                {
                  joinExpr: node.args.children[0],
                  childRecords: (await this.interpretNode(getJoinExpressionChild(node.args.children[0]), context))
                    .value,
                },
              ]
            : await Promise.all(
                node.args.children.map(async (joinExpr) => ({
                  joinExpr,
                  childRecords: (await this.interpretNode(getJoinExpressionChild(joinExpr), context)).value,
                })),
              )

        return { value: attachChildrenToParents(parent, children, node.args.canAssumeStrictEquality), lastInsertId }
      }

      case 'transaction': {
        if (!context.transactionManager.enabled) {
          return this.interpretNode(node.args, context)
        }

        const transactionManager = context.transactionManager.manager
        const transactionInfo = await transactionManager.startInternalTransaction()
        const transaction = await transactionManager.getTransaction(transactionInfo, 'query')
        try {
          const value = await this.interpretNode(node.args, { ...context, queryable: transaction })
          await transactionManager.commitTransaction(transactionInfo.id)
          return value
        } catch (e) {
          await transactionManager.rollbackTransaction(transactionInfo.id)
          throw e
        }
      }

      case 'dataMap': {
        const expr = node.args.expr
        const legacyExpr = Array.isArray(expr) ? undefined : (expr as QueryPlanLegacyNode)
        if (legacyExpr?.type === 'query' && !isRawSqlQuery(legacyExpr.args)) {
          const { structure, enums } = node.args
          if (isObjectResultNode(structure)) {
            const results = await this.#executeQuery(legacyExpr.args, context)
            return {
              value: applyDataMapToResultSet(results, structure, enums, this.#resultFormat),
              lastInsertId: results.lastInsertId,
            }
          }
        } else if (legacyExpr?.type === 'unique') {
          const uniqueExpr = Array.isArray(legacyExpr.args) ? undefined : (legacyExpr.args as QueryPlanLegacyNode)
          const { structure, enums } = node.args
          if (uniqueExpr?.type === 'query' && !isRawSqlQuery(uniqueExpr.args) && isObjectResultNode(structure)) {
            const results = await this.#executeQuery(uniqueExpr.args, context)
            const value = applyDataMapToResultSet(results, structure, enums, this.#resultFormat)

            if (value.length > 1) {
              throw new Error(`Expected zero or one element, got ${value.length}`)
            }
            return { value: value[0] ?? null, lastInsertId: results.lastInsertId }
          }
        }

        const { value, lastInsertId } = await this.interpretNode(expr, context)
        return { value: applyDataMap(value, node.args.structure, node.args.enums, this.#resultFormat), lastInsertId }
      }

      case 'validate': {
        const { value, lastInsertId } = await this.interpretNode(node.args.expr, context)
        performValidation(value, node.args.rules, node.args)

        return { value, lastInsertId }
      }

      case 'if': {
        const { value } = await this.interpretNode(node.args.value, context)
        if (doesSatisfyRule(value, node.args.rule)) {
          return await this.interpretNode(node.args.then, context)
        } else {
          return await this.interpretNode(node.args.else, context)
        }
      }

      case 'unit': {
        return { value: undefined }
      }

      case 'diff': {
        const { value: from } = await this.interpretNode(node.args.from, context)
        const { value: to } = await this.interpretNode(node.args.to, context)

        const keyGetter = (item: Value) => (item !== null ? getRecordKey(asRecord(item), node.args.fields) : null)

        const toSet = new Set(asList(to).map(keyGetter))
        return { value: asList(from).filter((item) => !toSet.has(keyGetter(item))) }
      }

      case 'process': {
        const { value, lastInsertId } = await this.interpretNode(node.args.expr, context)
        const ops = cloneObject(node.args.operations)
        evaluateProcessingParameters(ops, context.scope, context.generators)
        return { value: processRecords(value, ops), lastInsertId }
      }

      case 'initializeRecord': {
        const { lastInsertId } = await this.interpretNode(node.args.expr, context)

        const record = {}
        for (const [key, initializer] of Object.entries(node.args.fields) as [
          string,
          DeepReadonly<FieldInitializer>,
        ][]) {
          record[key] = evalFieldInitializer(initializer, lastInsertId, context.scope, context.generators)
        }
        return { value: record, lastInsertId }
      }

      case 'mapRecord': {
        const { value, lastInsertId } = await this.interpretNode(node.args.expr, context)

        const record = value === null ? {} : asRecord(value)
        for (const [key, entry] of Object.entries(node.args.fields) as [string, DeepReadonly<FieldOperation>][]) {
          record[key] = evalFieldOperation(entry, record[key], context.scope, context.generators)
        }
        return { value: record, lastInsertId }
      }

      default:
        throw new Error(`Unexpected node type: ${(node as { type: unknown }).type}`)
    }
  }

  #getCompiledNode(node: QueryPlanNode): CompiledQueryNode {
    if (Array.isArray(node)) {
      return this.#getCompiledCompactNode(node as QueryPlanCompactNode)
    }

    return (context) => this.interpretNode(node, context)
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
          const compiledChildren = mappedJoin.joinExpressions.map((joinExpr) =>
            this.#getCompiledNode(getJoinExpressionChild(joinExpr)),
          )

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
          name: getQueryPlanBindingName(binding),
          expr: this.#getCompiledNode(getQueryPlanBindingExpr(binding)),
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
        const compiledChildren = joinExpressions.map((joinExpr) =>
          this.#getCompiledNode(getJoinExpressionChild(joinExpr)),
        )
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
                    childRecords: (await this.interpretNode(getJoinExpressionChild(joinExpressions[0]), nestedContext))
                      .value,
                  },
                ]
              : await Promise.all(
                  joinExpressions.map(async (joinExpr) => ({
                    joinExpr,
                    childRecords: (await this.interpretNode(getJoinExpressionChild(joinExpr), nestedContext)).value,
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
          const { value } = await this.interpretNode(getQueryPlanBindingExpr(binding), nestedContext)
          nestedScope[getQueryPlanBindingName(binding)] = value
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
                  childRecords: (await this.interpretNode(getJoinExpressionChild(joinExpressions[0]), context)).value,
                },
              ]
            : await Promise.all(
                joinExpressions.map(async (joinExpr) => ({
                  joinExpr,
                  childRecords: (await this.interpretNode(getJoinExpressionChild(joinExpr), context)).value,
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

  #compileRawNestedReadQuery(
    query: RawNestedReadQuery,
    enums: Record<string, Record<string, string>>,
  ): CompiledRawNestedReadQuery {
    const dbQuery = query[0]
    const mappings = query[1]
    const relations = query[2]?.map((relation) => this.#compileRawNestedReadRelation(relation, enums))

    return async (context, scope) => {
      const resultSet = await this.#executeRawNestedReadDbQuery(dbQuery, context, scope)
      const records = mapRawNestedRows(resultSet, mappings, enums, this.#resultFormat)
      if (relations !== undefined && resultSet.rows.length > 0) {
        const result: RawNestedReadResult = {
          rows: resultSet.rows,
          columnNames: resultSet.columnNames,
          records,
        }
        for (const relation of relations) {
          await relation(result, context, scope)
        }
      }

      return {
        rows: resultSet.rows,
        columnNames: resultSet.columnNames,
        records,
      }
    }
  }

  #compileRawNestedReadRelation(
    relation: RawNestedReadRelation,
    enums: Record<string, Record<string, string>>,
  ): CompiledRawNestedReadRelation {
    if (relation[0] === 'r') {
      const childQuery = this.#compileRawNestedReadQuery(relation[2], enums)

      return async (parentResult, context, scope) => {
        const childScope = Object.create(scope) as Record<string, unknown>
        const parentColumnIndex = resolveRawResultColumnRef(parentResult.columnNames, relation[3])
        childScope[relation[5]] = getRawNestedScopeValue(parentResult.rows, parentColumnIndex)
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

    const childQuery = this.#compileRawNestedReadQuery(relation[3], enums)

    return async (parentResult, context, scope) => {
      const joinScope = Object.create(scope) as Record<string, unknown>
      const parentColumnIndex = resolveRawResultColumnRef(parentResult.columnNames, relation[4])
      joinScope[relation[8]] = getRawNestedScopeValue(parentResult.rows, parentColumnIndex)
      const joinResultSet = await this.#executeRawNestedReadDbQuery(relation[2], context, joinScope)
      const childScope = Object.create(scope) as Record<string, unknown>
      const joinChildColumnIndex = resolveRawResultColumnRef(joinResultSet.columnNames, relation[6])
      childScope[relation[9]] = getRawNestedScopeValue(joinResultSet.rows, joinChildColumnIndex)
      const childResult = await childQuery(context, childScope)

      attachRawNestedManyToManyRelation(
        parentResult.rows,
        parentResult.records,
        relation,
        parentColumnIndex,
        joinResultSet,
        childResult,
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
      return await context.queryable.queryRaw(asMutable(queries[0]))
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

function mapRawNestedRows(
  resultSet: SqlResultSet,
  mappings: readonly RawResultColumnMapping[],
  enums: Record<string, Record<string, string>>,
  resultFormat: QueryResultFormat,
): PrismaObject[] {
  const rows = resultSet.rows
  const resolvedMappings = resolveRawResultColumnMappings(resultSet.columnNames, mappings)
  const result = new Array<PrismaObject>(rows.length)
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]
    const record: PrismaObject = {}
    for (let mappingIndex = 0; mappingIndex < resolvedMappings.length; mappingIndex++) {
      const mapping = resolvedMappings[mappingIndex]
      const fieldNameOrPath = mapping[0]
      const columnIndex = mapping[1]
      const fieldType = mapping[2]
      const value = row[columnIndex]
      const mappedValue =
        fieldType === undefined
          ? value
          : mapRawNestedFieldValue(value, getRawNestedMappingName(fieldNameOrPath), fieldType, enums, resultFormat)
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

type ResolvedRawResultColumnMapping = readonly [
  fieldName: string | readonly string[],
  columnIndex: number,
  fieldType?: FieldType,
]

function resolveRawResultColumnMappings(
  columnNames: readonly string[],
  mappings: readonly RawResultColumnMapping[],
): ResolvedRawResultColumnMapping[] {
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
    resolvedMappings[i] = [mapping[0], resolveRawResultColumnRef(columnNames, mapping[1]), mapping[2]]
  }
  mappingsByColumnNames.set(columnNames, resolvedMappings)
  return resolvedMappings
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
  fieldType: FieldType,
  enums: Record<string, Record<string, string>>,
  resultFormat: QueryResultFormat,
): unknown {
  if (value === null && typeof fieldType === 'string') {
    return null
  }

  switch (fieldType) {
    case 's':
    case 'string':
      if (typeof value === 'string') {
        return value
      }
      break

    case 'i':
    case 'int':
      if (typeof value === 'number') {
        return Math.trunc(value)
      }
      break

    case 'f':
    case 'float':
      if (typeof value === 'number') {
        return value
      }
      break

    case 'b':
    case 'boolean':
      if (typeof value === 'boolean') {
        return value
      }
      break

    case 'x':
    case 'unsupported':
      return value
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
  const fieldName = relation[1]
  const isRelationUnique = relation[6]

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

function attachRawNestedManyToManyRelation(
  parentRows: readonly unknown[][],
  parentRecords: readonly PrismaObject[],
  relation: RawNestedReadManyToManyRelation,
  parentColumnIndex: number,
  joinResultSet: SqlResultSet,
  childResult: RawNestedReadResult,
): void {
  const fieldName = relation[1]
  const joinRows = joinResultSet.rows
  const joinParentColumnIndex = resolveRawResultColumnRef(joinResultSet.columnNames, relation[5])
  const joinChildColumnIndex = resolveRawResultColumnRef(joinResultSet.columnNames, relation[6])
  const childColumnIndex = resolveRawResultColumnRef(childResult.columnNames, relation[7])

  for (let parentIndex = 0; parentIndex < parentRecords.length; parentIndex++) {
    const parentKey = parentRows[parentIndex][parentColumnIndex]
    const children: PrismaObject[] = []
    for (let joinIndex = 0; joinIndex < joinRows.length; joinIndex++) {
      const joinRow = joinRows[joinIndex]
      if (joinRow[joinParentColumnIndex] !== parentKey) {
        continue
      }

      const child = findRawNestedChild(
        joinRow[joinChildColumnIndex],
        childResult.rows,
        childResult.records,
        childColumnIndex,
      )
      if (child !== null) {
        children.push(child)
      }
    }
    parentRecords[parentIndex][fieldName] = children
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
  const parentName = getQueryPlanBindingName(parentBinding)
  const parentExpr = getQueryPlanBindingExpr(parentBinding)
  const innerLet = node[2]
  if (!Array.isArray(innerLet) || innerLet[0] !== 'l' || innerLet[1].length < 2) {
    return undefined
  }

  const innerBindings = innerLet[1] as QueryPlanBinding[]
  const mappedBindings = new Array<{ name: string; field: string }>(innerBindings.length)
  for (let i = 0; i < innerBindings.length; i++) {
    const binding = innerBindings[i]
    const mapExpr = getQueryPlanBindingExpr(binding)
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
      name: getQueryPlanBindingName(binding),
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
  const parentName = getQueryPlanBindingName(parentBinding)
  const parentExpr = getQueryPlanBindingExpr(parentBinding)
  const innerLet = node[2]
  if (!Array.isArray(innerLet) || innerLet[0] !== 'l' || innerLet[1].length !== 1) {
    return undefined
  }

  const mappedBinding = innerLet[1][0] as QueryPlanBinding
  const mappedName = getQueryPlanBindingName(mappedBinding)
  const mapExpr = getQueryPlanBindingExpr(mappedBinding)
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
    const on = getJoinExpressionOn(joinExpr)
    const parentField = getJoinExpressionParentField(joinExpr)
    const isRelationUnique = getJoinExpressionIsRelationUnique(joinExpr)

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
