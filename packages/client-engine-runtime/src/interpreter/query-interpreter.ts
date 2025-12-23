import { ConnectionInfo, SqlQuery, SqlQueryable, SqlResultSet } from '@prisma/driver-adapter-utils'
import type { SqlCommenterPlugin, SqlCommenterQueryInfo } from '@prisma/sqlcommenter'

import { QueryEvent } from '../events'
import { FieldInitializer, FieldOperation, JoinExpression, QueryPlanDbQuery, QueryPlanNode, ResultNode } from '../query-plan'
import { type SchemaProvider } from '../schema'
import { appendSqlComment, buildSqlComment } from '../sql-commenter'
import { type TracingHelper, withQuerySpanAndEvent } from '../tracing'
import { type TransactionManager } from '../transaction-manager/transaction-manager'
import { rethrowAsUserFacing, rethrowAsUserFacingRawError } from '../user-facing-error'
import { assertNever } from '../utils'
import { applyDataMap } from './data-mapper'
import { GeneratorRegistry, GeneratorRegistrySnapshot } from './generators'
import { getRecordKey, processRecords } from './in-memory-processing'
import { evaluateArg, renderQuery } from './render-query'
import { PrismaObject, ScopeBindings, Value } from './scope'
import { serializeRawSql, serializeSql } from './serialize-sql'
import { doesSatisfyRule, performValidation } from './validation'

/**
 * Represents a simple read query pattern that can be executed with minimal async overhead.
 * These patterns have a single SQL query at the leaf, followed by pure transformation nodes.
 */
type SimpleReadPattern = {
  queryNode: { type: 'query'; args: QueryPlanDbQuery }
  transformations: Array<
    | { type: 'unique' }
    | { type: 'reverse' }
    | { type: 'required' }
    | { type: 'dataMap'; structure: ResultNode; enums: Record<string, Record<string, string>> }
  >
}

/**
 * Detects if a query plan matches a simple read pattern that can be optimized.
 * Simple patterns: dataMap → [unique|reverse|required]* → query
 */
function detectSimpleReadPattern(node: QueryPlanNode): SimpleReadPattern | null {
  const transformations: SimpleReadPattern['transformations'] = []

  let current: QueryPlanNode = node

  // Walk down the tree, collecting transformations
  while (true) {
    switch (current.type) {
      case 'dataMap':
        transformations.push({
          type: 'dataMap',
          structure: current.args.structure,
          enums: current.args.enums,
        })
        current = current.args.expr
        break

      case 'unique':
        transformations.push({ type: 'unique' })
        current = current.args
        break

      case 'reverse':
        transformations.push({ type: 'reverse' })
        current = current.args
        break

      case 'required':
        transformations.push({ type: 'required' })
        current = current.args
        break

      case 'query':
        // Found the query node at the leaf - this is a simple pattern
        if (current.args.type === 'rawSql') {
          // Raw SQL queries go through the normal path for proper error handling
          return null
        }
        return {
          queryNode: current as { type: 'query'; args: QueryPlanDbQuery },
          transformations,
        }

      default:
        // Any other node type breaks the simple pattern
        return null
    }
  }
}

export type QueryInterpreterTransactionManager = { enabled: true; manager: TransactionManager } | { enabled: false }

export type QueryInterpreterOptions = {
  transactionManager: QueryInterpreterTransactionManager
  placeholderValues: Record<string, unknown>
  onQuery?: (event: QueryEvent) => void
  tracingHelper: TracingHelper
  serializer: (results: SqlResultSet) => Value
  rawSerializer?: (results: SqlResultSet) => Value
  provider?: SchemaProvider
  connectionInfo?: ConnectionInfo
  sqlCommenter?: QueryInterpreterSqlCommenter
}

export type QueryInterpreterSqlCommenter = {
  plugins: SqlCommenterPlugin[]
  queryInfo: SqlCommenterQueryInfo
}

export class QueryInterpreter {
  readonly #transactionManager: QueryInterpreterTransactionManager
  readonly #placeholderValues: Record<string, unknown>
  readonly #onQuery?: (event: QueryEvent) => void
  readonly #generators: GeneratorRegistry = new GeneratorRegistry()
  readonly #tracingHelper: TracingHelper
  readonly #serializer: (results: SqlResultSet) => Value
  readonly #rawSerializer: (results: SqlResultSet) => Value
  readonly #provider?: SchemaProvider
  readonly #connectionInfo?: ConnectionInfo
  readonly #sqlCommenter?: QueryInterpreterSqlCommenter

  constructor({
    transactionManager,
    placeholderValues,
    onQuery,
    tracingHelper,
    serializer,
    rawSerializer,
    provider,
    connectionInfo,
    sqlCommenter,
  }: QueryInterpreterOptions) {
    this.#transactionManager = transactionManager
    this.#placeholderValues = placeholderValues
    this.#onQuery = onQuery
    this.#tracingHelper = tracingHelper
    this.#serializer = serializer
    this.#rawSerializer = rawSerializer ?? serializer
    this.#provider = provider
    this.#connectionInfo = connectionInfo
    this.#sqlCommenter = sqlCommenter
  }

  static forSql(options: {
    transactionManager: QueryInterpreterTransactionManager
    placeholderValues: Record<string, unknown>
    onQuery?: (event: QueryEvent) => void
    tracingHelper: TracingHelper
    provider?: SchemaProvider
    connectionInfo?: ConnectionInfo
    sqlCommenter?: QueryInterpreterSqlCommenter
  }): QueryInterpreter {
    return new QueryInterpreter({
      transactionManager: options.transactionManager,
      placeholderValues: options.placeholderValues,
      onQuery: options.onQuery,
      tracingHelper: options.tracingHelper,
      serializer: serializeSql,
      rawSerializer: serializeRawSql,
      provider: options.provider,
      connectionInfo: options.connectionInfo,
      sqlCommenter: options.sqlCommenter,
    })
  }

  async run(queryPlan: QueryPlanNode, queryable: SqlQueryable): Promise<unknown> {
    // Try fast path for simple read queries (single SQL query + pure transformations)
    const simplePattern = detectSimpleReadPattern(queryPlan)
    if (simplePattern !== null) {
      return this.#runSimple(simplePattern, queryable).catch((e) => rethrowAsUserFacing(e))
    }

    // Standard recursive path for complex query plans
    const { value } = await this.interpretNode(
      queryPlan,
      queryable,
      this.#placeholderValues,
      this.#generators.snapshot(),
    ).catch((e) => rethrowAsUserFacing(e))

    return value
  }

  /**
   * Fast path for simple read queries with minimal async overhead.
   * Executes a single SQL query and applies transformations synchronously.
   */
  async #runSimple(pattern: SimpleReadPattern, queryable: SqlQueryable): Promise<unknown> {
    const generators = this.#generators.snapshot()
    const queries = renderQuery(pattern.queryNode.args, this.#placeholderValues, generators, this.#maxChunkSize())

    // Execute the SQL query (single async boundary)
    let results: SqlResultSet | undefined
    for (const query of queries) {
      const commentedQuery = this.#applyComments(query)
      const result = await this.#withQuerySpanAndEvent(commentedQuery, queryable, () =>
        queryable.queryRaw(commentedQuery),
      )
      if (results === undefined) {
        results = result
      } else {
        results.rows.push(...result.rows)
        results.lastInsertId = result.lastInsertId
      }
    }

    // Serialize the results
    let value: Value = this.#serializer(results!)

    // Apply transformations in reverse order (since we collected from outer to inner)
    for (let i = pattern.transformations.length - 1; i >= 0; i--) {
      const transform = pattern.transformations[i]
      switch (transform.type) {
        case 'unique':
          if (Array.isArray(value)) {
            if (value.length > 1) {
              throw new Error(`Expected zero or one element, got ${value.length}`)
            }
            value = value[0] ?? null
          }
          break

        case 'reverse':
          if (Array.isArray(value)) {
            value = value.reverse()
          }
          break

        case 'required':
          if (isEmpty(value)) {
            throw new Error('Required value is empty')
          }
          break

        case 'dataMap':
          value = applyDataMap(value, transform.structure, transform.enums)
          break
      }
    }

    return value
  }

  private async interpretNode(
    node: QueryPlanNode,
    queryable: SqlQueryable,
    scope: ScopeBindings,
    generators: GeneratorRegistrySnapshot,
  ): Promise<IntermediateValue> {
    switch (node.type) {
      case 'value': {
        return wrapValue(evaluateArg(node.args, scope, generators))
      }

      case 'seq': {
        let result: IntermediateValue | undefined
        for (const arg of node.args) {
          result = await this.interpretNode(arg, queryable, scope, generators)
        }
        return result ?? wrapValue(undefined)
      }

      case 'get': {
        return wrapValue(scope[node.args.name])
      }

      case 'let': {
        const nestedScope: ScopeBindings = Object.create(scope)
        for (const binding of node.args.bindings) {
          const { value } = await this.interpretNode(binding.expr, queryable, nestedScope, generators)
          nestedScope[binding.name] = value
        }
        return this.interpretNode(node.args.expr, queryable, nestedScope, generators)
      }

      case 'getFirstNonEmpty': {
        for (const name of node.args.names) {
          const value = scope[name]
          if (!isEmpty(value)) {
            return wrapValue(value)
          }
        }
        return wrapValue([])
      }

      case 'concat': {
        const parts = await Promise.all(
          node.args.map((arg) => this.interpretNode(arg, queryable, scope, generators).then((res) => res.value)),
        )
        if (parts.length === 0) {
          return wrapValue([])
        }
        const result: Value[] = []
        for (const part of parts) {
          if (Array.isArray(part)) {
            result.push(...part)
          } else {
            result.push(part)
          }
        }
        return wrapValue(result)
      }

      case 'sum': {
        const parts = await Promise.all(
          node.args.map((arg) => this.interpretNode(arg, queryable, scope, generators).then((res) => res.value)),
        )
        return wrapValue(parts.length > 0 ? parts.reduce((acc, part) => asNumber(acc) + asNumber(part)) : 0)
      }

      case 'execute': {
        const queries = renderQuery(node.args, scope, generators, this.#maxChunkSize())

        let sum = 0
        for (const query of queries) {
          const commentedQuery = this.#applyComments(query)
          sum += await this.#withQuerySpanAndEvent(commentedQuery, queryable, () =>
            queryable
              .executeRaw(commentedQuery)
              .catch((err) =>
                node.args.type === 'rawSql' ? rethrowAsUserFacingRawError(err) : rethrowAsUserFacing(err),
              ),
          )
        }

        return wrapValue(sum)
      }

      case 'query': {
        const queries = renderQuery(node.args, scope, generators, this.#maxChunkSize())

        let results: SqlResultSet | undefined
        for (const query of queries) {
          const commentedQuery = this.#applyComments(query)
          const result = await this.#withQuerySpanAndEvent(commentedQuery, queryable, () =>
            queryable
              .queryRaw(commentedQuery)
              .catch((err) =>
                node.args.type === 'rawSql' ? rethrowAsUserFacingRawError(err) : rethrowAsUserFacing(err),
              ),
          )
          if (results === undefined) {
            results = result
          } else {
            results.rows.push(...result.rows)
            results.lastInsertId = result.lastInsertId
          }
        }

        return {
          value: node.args.type === 'rawSql' ? this.#rawSerializer(results!) : this.#serializer(results!),
          lastInsertId: results?.lastInsertId,
        }
      }

      case 'reverse': {
        const { value, lastInsertId } = await this.interpretNode(node.args, queryable, scope, generators)
        return { value: Array.isArray(value) ? value.reverse() : value, lastInsertId }
      }

      case 'unique': {
        const { value, lastInsertId } = await this.interpretNode(node.args, queryable, scope, generators)
        if (!Array.isArray(value)) {
          return { value, lastInsertId }
        }
        if (value.length > 1) {
          throw new Error(`Expected zero or one element, got ${value.length}`)
        }
        return { value: value[0] ?? null, lastInsertId }
      }

      case 'required': {
        const { value, lastInsertId } = await this.interpretNode(node.args, queryable, scope, generators)
        if (isEmpty(value)) {
          throw new Error('Required value is empty')
        }
        return { value, lastInsertId }
      }

      case 'mapField': {
        const { value, lastInsertId } = await this.interpretNode(node.args.records, queryable, scope, generators)
        return { value: mapField(value, node.args.field), lastInsertId }
      }

      case 'join': {
        const { value: parent, lastInsertId } = await this.interpretNode(node.args.parent, queryable, scope, generators)

        if (parent === null) {
          return { value: null, lastInsertId }
        }

        const children = (await Promise.all(
          node.args.children.map(async (joinExpr) => ({
            joinExpr,
            childRecords: (await this.interpretNode(joinExpr.child, queryable, scope, generators)).value,
          })),
        )) satisfies JoinExpressionWithRecords[]

        return { value: attachChildrenToParents(parent, children), lastInsertId }
      }

      case 'transaction': {
        if (!this.#transactionManager.enabled) {
          return this.interpretNode(node.args, queryable, scope, generators)
        }

        const transactionManager = this.#transactionManager.manager
        const transactionInfo = await transactionManager.startInternalTransaction()
        const transaction = await transactionManager.getTransaction(transactionInfo, 'query')
        try {
          const value = await this.interpretNode(node.args, transaction, scope, generators)
          await transactionManager.commitTransaction(transactionInfo.id)
          return value
        } catch (e) {
          await transactionManager.rollbackTransaction(transactionInfo.id)
          throw e
        }
      }

      case 'dataMap': {
        const { value, lastInsertId } = await this.interpretNode(node.args.expr, queryable, scope, generators)
        return { value: applyDataMap(value, node.args.structure, node.args.enums), lastInsertId }
      }

      case 'validate': {
        const { value, lastInsertId } = await this.interpretNode(node.args.expr, queryable, scope, generators)
        performValidation(value, node.args.rules, node.args)

        return { value, lastInsertId }
      }

      case 'if': {
        const { value } = await this.interpretNode(node.args.value, queryable, scope, generators)
        if (doesSatisfyRule(value, node.args.rule)) {
          return await this.interpretNode(node.args.then, queryable, scope, generators)
        } else {
          return await this.interpretNode(node.args.else, queryable, scope, generators)
        }
      }

      case 'unit': {
        return wrapValue(undefined)
      }

      case 'diff': {
        const { value: from } = await this.interpretNode(node.args.from, queryable, scope, generators)
        const { value: to } = await this.interpretNode(node.args.to, queryable, scope, generators)

        const keyGetter = (item: Value) => (item !== null ? getRecordKey(asRecord(item), node.args.fields) : null)

        const toSet = new Set(asList(to).map(keyGetter))
        return wrapValue(asList(from).filter((item) => !toSet.has(keyGetter(item))))
      }

      case 'process': {
        const { value, lastInsertId } = await this.interpretNode(node.args.expr, queryable, scope, generators)
        return { value: processRecords(value, node.args.operations), lastInsertId }
      }

      case 'initializeRecord': {
        const { lastInsertId } = await this.interpretNode(node.args.expr, queryable, scope, generators)

        const record = {}
        for (const [key, initializer] of Object.entries(node.args.fields)) {
          record[key] = evalFieldInitializer(initializer, lastInsertId, scope, generators)
        }
        return { value: record, lastInsertId }
      }

      case 'mapRecord': {
        const { value, lastInsertId } = await this.interpretNode(node.args.expr, queryable, scope, generators)

        const record = value === null ? {} : asRecord(value)
        for (const [key, entry] of Object.entries(node.args.fields)) {
          record[key] = evalFieldOperation(entry, record[key], scope, generators)
        }
        return { value: record, lastInsertId }
      }

      default:
        assertNever(node, `Unexpected node type: ${(node as { type: unknown }).type}`)
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

  #withQuerySpanAndEvent<T>(query: SqlQuery, queryable: SqlQueryable, execute: () => Promise<T>): Promise<T> {
    return withQuerySpanAndEvent({
      query,
      execute,
      provider: this.#provider ?? queryable.provider,
      tracingHelper: this.#tracingHelper,
      onQuery: this.#onQuery,
    })
  }

  #applyComments(query: SqlQuery): SqlQuery {
    if (!this.#sqlCommenter || this.#sqlCommenter.plugins.length === 0) {
      return query
    }

    const comment = buildSqlComment(this.#sqlCommenter.plugins, {
      query: this.#sqlCommenter.queryInfo,
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
}

type IntermediateValue = { value: Value; lastInsertId?: string }

function wrapValue(value: Value): IntermediateValue {
  return { value }
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

function attachChildrenToParents(parentRecords: unknown, children: JoinExpressionWithRecords[]) {
  const parentRecordsArray = Array.isArray(parentRecords) ? parentRecords : [parentRecords]

  for (const { joinExpr, childRecords } of children) {
    const parentKeys = joinExpr.on.map(([k]) => k)
    const childKeys = joinExpr.on.map(([, k]) => k)
    const parentMap = {}

    for (const parent of parentRecordsArray) {
      const parentRecord = asRecord(parent)
      const key = getRecordKey(parentRecord, parentKeys)
      if (!parentMap[key]) {
        parentMap[key] = []
      }
      parentMap[key].push(parentRecord)

      if (joinExpr.isRelationUnique) {
        parentRecord[joinExpr.parentField] = null
      } else {
        parentRecord[joinExpr.parentField] = []
      }
    }

    const childRecordsArray = Array.isArray(childRecords) ? childRecords : [childRecords]
    for (const childRecord of childRecordsArray) {
      if (childRecord === null) {
        continue
      }

      const key = getRecordKey(asRecord(childRecord), childKeys)
      const parents = parentMap[key]
      if (parents !== undefined) {
        if (joinExpr.isRelationUnique) {
          for (const parentRecord of parents) {
            parentRecord[joinExpr.parentField] = childRecord
          }
        } else {
          for (const parentRecord of parents) {
            parentRecord[joinExpr.parentField].push(childRecord)
          }
        }
      }
    }
  }

  return parentRecords
}

function evalFieldInitializer(
  initializer: FieldInitializer,
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
  op: FieldOperation,
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
