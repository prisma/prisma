import { ConnectionInfo, SqlQuery, SqlQueryable, SqlResultSet } from '@prisma/driver-adapter-utils'
import type { SqlCommenterPlugin, SqlCommenterQueryInfo } from '@prisma/sqlcommenter'
import { klona } from 'klona'

import { QueryEvent } from '../events'
import {
  type CompactResultObjectNode,
  FieldInitializer,
  FieldOperation,
  getJoinExpressionChild,
  getJoinExpressionIsRelationUnique,
  getJoinExpressionOn,
  getJoinExpressionParentField,
  getQueryPlanBindingExpr,
  getQueryPlanBindingName,
  getValidationError,
  InMemoryOps,
  JoinExpression,
  type QueryPlanCompactNode,
  QueryPlanDbQuery,
  type QueryPlanLegacyNode,
  QueryPlanNode,
  type QueryPlanRawSql,
  type ResultNode,
  type ResultObjectNode,
} from '../query-plan'
import { type SchemaProvider } from '../schema'
import { appendSqlComment, buildSqlComment } from '../sql-commenter'
import { type TracingHelper, withQuerySpanAndEvent } from '../tracing'
import { type TransactionManager } from '../transaction-manager/transaction-manager'
import { rethrowAsUserFacing, rethrowAsUserFacingRawError } from '../user-facing-error'
import { assertNever, DeepReadonly, DeepUnreadonly } from '../utils'
import { applyDataMap, applyDataMapToResultSet } from './data-mapper'
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
  sqlCommenter?: QueryInterpreterSqlCommenter
}

export type QueryInterpreterSqlCommenter = {
  plugins: SqlCommenterPlugin[]
  queryInfo: SqlCommenterQueryInfo
}

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
  readonly #connectionInfo?: ConnectionInfo

  constructor({
    onQuery,
    tracingHelper,
    serializer,
    rawSerializer,
    provider,
    connectionInfo,
  }: QueryInterpreterOptions) {
    this.#onQuery = onQuery
    this.#tracingHelper = tracingHelper
    this.#serializer = serializer
    this.#rawSerializer = rawSerializer ?? serializer
    this.#provider = provider
    this.#connectionInfo = connectionInfo
  }

  static forSql(options: {
    onQuery?: (event: QueryEvent) => void
    tracingHelper: TracingHelper
    provider?: SchemaProvider
    connectionInfo?: ConnectionInfo
  }): QueryInterpreter {
    return new QueryInterpreter({
      onQuery: options.onQuery,
      tracingHelper: options.tracingHelper,
      serializer: serializeSql,
      rawSerializer: serializeRawSql,
      provider: options.provider,
      connectionInfo: options.connectionInfo,
    })
  }

  async run(queryPlan: QueryPlanNode, options: QueryRuntimeOptions): Promise<unknown> {
    const { value } = await this.interpretNode(queryPlan, {
      ...options,
      generators: this.#generators.snapshot(),
    }).catch((e) => rethrowAsUserFacing(e))

    return value
  }

  private async interpretNode(queryNode: QueryPlanNode, context: QueryRuntimeContext): Promise<IntermediateValue> {
    if (Array.isArray(queryNode)) {
      return this.#interpretCompactNode(queryNode as QueryPlanCompactNode, context)
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
        for (const binding of node.args.bindings) {
          const { value } = await this.interpretNode(getQueryPlanBindingExpr(binding), {
            ...context,
            scope: nestedScope,
          })
          nestedScope[getQueryPlanBindingName(binding)] = value
        }
        return this.interpretNode(node.args.expr, { ...context, scope: nestedScope })
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
        const queries = renderQuery(node.args, context.scope, context.generators, this.#maxChunkSize())
        const hasSqlCommenter = context.sqlCommenter !== undefined && context.sqlCommenter.plugins.length > 0
        const usesQueryInstrumentation = this.#usesQueryInstrumentation()
        const isRaw = isRawSqlQuery(node.args)
        const handleError = isRaw ? rethrowAsUserFacingRawError : rethrowAsUserFacing

        let sum = 0
        for (const query of queries) {
          const queryToExecute = hasSqlCommenter ? applyComments(query, context.sqlCommenter) : query
          if (usesQueryInstrumentation) {
            sum += await this.#withQuerySpanAndEvent(queryToExecute, context.queryable, () =>
              context.queryable.executeRaw(cloneObject(queryToExecute)).catch(handleError),
            )
          } else {
            sum += await context.queryable.executeRaw(cloneObject(queryToExecute)).catch(handleError)
          }
        }

        return { value: sum }
      }

      case 'query': {
        const queries = renderQuery(node.args, context.scope, context.generators, this.#maxChunkSize())
        const hasSqlCommenter = context.sqlCommenter !== undefined && context.sqlCommenter.plugins.length > 0
        const usesQueryInstrumentation = this.#usesQueryInstrumentation()
        const isRaw = isRawSqlQuery(node.args)
        const handleError = isRaw ? rethrowAsUserFacingRawError : rethrowAsUserFacing

        let results: SqlResultSet | undefined
        for (const query of queries) {
          const queryToExecute = hasSqlCommenter ? applyComments(query, context.sqlCommenter) : query
          const result = usesQueryInstrumentation
            ? await this.#withQuerySpanAndEvent(queryToExecute, context.queryable, () =>
                context.queryable.queryRaw(cloneObject(queryToExecute)).catch(handleError),
              )
            : await context.queryable.queryRaw(cloneObject(queryToExecute)).catch(handleError)
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

        const children = await Promise.all(
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
            return { value: applyDataMapToResultSet(results, structure, enums), lastInsertId: results.lastInsertId }
          }
        } else if (legacyExpr?.type === 'unique') {
          const uniqueExpr = Array.isArray(legacyExpr.args) ? undefined : (legacyExpr.args as QueryPlanLegacyNode)
          const { structure, enums } = node.args
          if (uniqueExpr?.type === 'query' && !isRawSqlQuery(uniqueExpr.args) && isObjectResultNode(structure)) {
            const results = await this.#executeQuery(uniqueExpr.args, context)
            const value = applyDataMapToResultSet(results, structure, enums)

            if (value.length > 1) {
              throw new Error(`Expected zero or one element, got ${value.length}`)
            }
            return { value: value[0] ?? null, lastInsertId: results.lastInsertId }
          }
        }

        const { value, lastInsertId } = await this.interpretNode(expr, context)
        return { value: applyDataMap(value, node.args.structure, node.args.enums), lastInsertId }
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
        const nestedScope: ScopeBindings = Object.create(context.scope)
        for (const binding of node[1]) {
          const { value } = await this.interpretNode(getQueryPlanBindingExpr(binding), {
            ...context,
            scope: nestedScope,
          })
          nestedScope[getQueryPlanBindingName(binding)] = value
        }
        return this.interpretNode(node[2], { ...context, scope: nestedScope })
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
        const queries = renderQuery(dbQuery, context.scope, context.generators, this.#maxChunkSize())
        const hasSqlCommenter = context.sqlCommenter !== undefined && context.sqlCommenter.plugins.length > 0
        const usesQueryInstrumentation = this.#usesQueryInstrumentation()
        const isRaw = isRawSqlQuery(dbQuery)
        const handleError = isRaw ? rethrowAsUserFacingRawError : rethrowAsUserFacing

        let sum = 0
        for (const query of queries) {
          const queryToExecute = hasSqlCommenter ? applyComments(query, context.sqlCommenter) : query
          if (usesQueryInstrumentation) {
            sum += await this.#withQuerySpanAndEvent(queryToExecute, context.queryable, () =>
              context.queryable.executeRaw(cloneObject(queryToExecute)).catch(handleError),
            )
          } else {
            sum += await context.queryable.executeRaw(cloneObject(queryToExecute)).catch(handleError)
          }
        }

        return { value: sum }
      }

      case 'q': {
        const dbQuery = node[1]
        const queries = renderQuery(dbQuery, context.scope, context.generators, this.#maxChunkSize())
        const hasSqlCommenter = context.sqlCommenter !== undefined && context.sqlCommenter.plugins.length > 0
        const usesQueryInstrumentation = this.#usesQueryInstrumentation()
        const isRaw = isRawSqlQuery(dbQuery)
        const handleError = isRaw ? rethrowAsUserFacingRawError : rethrowAsUserFacing

        let results: SqlResultSet | undefined
        for (const query of queries) {
          const queryToExecute = hasSqlCommenter ? applyComments(query, context.sqlCommenter) : query
          const result = usesQueryInstrumentation
            ? await this.#withQuerySpanAndEvent(queryToExecute, context.queryable, () =>
                context.queryable.queryRaw(cloneObject(queryToExecute)).catch(handleError),
              )
            : await context.queryable.queryRaw(cloneObject(queryToExecute)).catch(handleError)
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

        const children = await Promise.all(
          node[2].map(async (joinExpr) => ({
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
        const enums = node[3]
        if (isCompactQueryNode(expr) && !isRawSqlQuery(expr[1])) {
          if (isObjectResultNode(structure)) {
            const results = await this.#executeQuery(expr[1], context)
            return {
              value: applyDataMapToResultSet(results, structure, enums),
              lastInsertId: results.lastInsertId,
            }
          }
        } else if (isCompactUniqueQueryNode(expr) && !isRawSqlQuery(expr[1][1])) {
          if (isObjectResultNode(structure)) {
            const results = await this.#executeQuery(expr[1][1], context)
            const value = applyDataMapToResultSet(results, structure, enums)

            if (value.length > 1) {
              throw new Error(`Expected zero or one element, got ${value.length}`)
            }
            return { value: value[0] ?? null, lastInsertId: results.lastInsertId }
          }
        }

        const { value, lastInsertId } = await this.interpretNode(expr, context)
        return { value: applyDataMap(value, structure, enums), lastInsertId }
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

  #maxChunkSize(): number | undefined {
    if (this.#connectionInfo?.maxBindValues !== undefined) {
      return this.#connectionInfo.maxBindValues
    }
    return this.#providerMaxChunkSize()
  }

  #providerMaxChunkSize(): number | undefined {
    if (this.#provider === undefined) {
      return undefined
    }
    switch (this.#provider) {
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
        assertNever(this.#provider, `Unexpected provider: ${this.#provider}`)
    }
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

  async #executeQuery(dbQuery: DeepReadonly<QueryPlanDbQuery>, context: QueryRuntimeContext): Promise<SqlResultSet> {
    const queries = renderQuery(dbQuery, context.scope, context.generators, this.#maxChunkSize())
    const hasSqlCommenter = context.sqlCommenter !== undefined && context.sqlCommenter.plugins.length > 0
    const usesQueryInstrumentation = this.#usesQueryInstrumentation()
    const handleError = isRawSqlQuery(dbQuery) ? rethrowAsUserFacingRawError : rethrowAsUserFacing

    let results: SqlResultSet | undefined
    for (const query of queries) {
      const queryToExecute = hasSqlCommenter ? applyComments(query, context.sqlCommenter) : query
      const result = usesQueryInstrumentation
        ? await this.#withQuerySpanAndEvent(queryToExecute, context.queryable, () =>
            context.queryable.queryRaw(cloneObject(queryToExecute)).catch(handleError),
          )
        : await context.queryable.queryRaw(cloneObject(queryToExecute)).catch(handleError)
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

type IntermediateValue = { value: Value; lastInsertId?: string }

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
    return value.map((element) => mapField(element, field))
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
    const parentKeys = new Array<string>(on.length)
    const childKeys = new Array<string>(on.length)
    for (let i = 0; i < on.length; i++) {
      parentKeys[i] = on[i][0]
      childKeys[i] = on[i][1]
    }
    const parentKey = parentKeys[0]
    const childKey = childKeys[0]

    const parentArray = Array.isArray(parentRecords) ? parentRecords : [parentRecords]
    const childArray = Array.isArray(childRecords) ? childRecords : [childRecords]
    const useSingleStrictKey =
      canAssumeStrictEquality && parentKeys.length === 1 && parentArray.length + childArray.length >= 8
    const parentMap = useSingleStrictKey ? (Object.create(null) as Record<string, PrismaObject[]>) : {}

    for (const parent of parentArray) {
      const parentRecord = asRecord(parent)
      const key = useSingleStrictKey ? getScalarRecordKey(parentRecord[parentKey]) : getRecordKey(parentRecord, parentKeys)
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
    for (const [i, key] of keys.entries()) {
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
