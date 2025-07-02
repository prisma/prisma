import { SqlQuery, SqlQueryable, SqlResultSet } from '@prisma/driver-adapter-utils'

import { QueryEvent } from '../events'
import { FieldInitializer, FieldOperation, JoinExpression, Pagination, QueryPlanNode } from '../QueryPlan'
import { type SchemaProvider } from '../schema'
import { type TracingHelper, withQuerySpanAndEvent } from '../tracing'
import { type TransactionManager } from '../transactionManager/TransactionManager'
import { rethrowAsUserFacing } from '../UserFacingError'
import { assertNever, doKeysMatch } from '../utils'
import { applyDataMap } from './DataMapper'
import { GeneratorRegistry, GeneratorRegistrySnapshot } from './generators'
import { evaluateParam, renderQuery } from './renderQuery'
import { PrismaObject, ScopeBindings, Value } from './scope'
import { serializeRawSql, serializeSql } from './serializeSql'
import { doesSatisfyRule, performValidation } from './validation'

export type QueryInterpreterTransactionManager = { enabled: true; manager: TransactionManager } | { enabled: false }

export type QueryInterpreterOptions = {
  transactionManager: QueryInterpreterTransactionManager
  placeholderValues: Record<string, unknown>
  onQuery?: (event: QueryEvent) => void
  tracingHelper: TracingHelper
  serializer: (results: SqlResultSet) => Value
  rawSerializer?: (results: SqlResultSet) => Value
  provider?: SchemaProvider
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

  constructor({
    transactionManager,
    placeholderValues,
    onQuery,
    tracingHelper,
    serializer,
    rawSerializer,
    provider,
  }: QueryInterpreterOptions) {
    this.#transactionManager = transactionManager
    this.#placeholderValues = placeholderValues
    this.#onQuery = onQuery
    this.#tracingHelper = tracingHelper
    this.#serializer = serializer
    this.#rawSerializer = rawSerializer ?? serializer
    this.#provider = provider
  }

  static forSql(options: {
    transactionManager: QueryInterpreterTransactionManager
    placeholderValues: Record<string, unknown>
    onQuery?: (event: QueryEvent) => void
    tracingHelper: TracingHelper
    provider?: SchemaProvider
  }): QueryInterpreter {
    return new QueryInterpreter({
      transactionManager: options.transactionManager,
      placeholderValues: options.placeholderValues,
      onQuery: options.onQuery,
      tracingHelper: options.tracingHelper,
      serializer: serializeSql,
      rawSerializer: serializeRawSql,
      provider: options.provider,
    })
  }

  async run(queryPlan: QueryPlanNode, queryable: SqlQueryable): Promise<unknown> {
    const { value } = await this.interpretNode(
      queryPlan,
      queryable,
      this.#placeholderValues,
      this.#generators.snapshot(queryable.provider),
    ).catch((e) => rethrowAsUserFacing(e))

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
        return { value: evaluateParam(node.args, scope, generators) }
      }

      case 'seq': {
        let result: IntermediateValue | undefined
        for (const arg of node.args) {
          result = await this.interpretNode(arg, queryable, scope, generators)
        }
        return result ?? { value: undefined }
      }

      case 'get': {
        return { value: scope[node.args.name] }
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
            return { value }
          }
        }
        return { value: [] }
      }

      case 'concat': {
        const parts = await Promise.all(
          node.args.map((arg) => this.interpretNode(arg, queryable, scope, generators).then((res) => res.value)),
        )
        return {
          value: parts.length > 0 ? parts.reduce<Value[]>((acc, part) => acc.concat(asList(part)), []) : [],
        }
      }

      case 'sum': {
        const parts = await Promise.all(
          node.args.map((arg) => this.interpretNode(arg, queryable, scope, generators).then((res) => res.value)),
        )
        return {
          value: parts.length > 0 ? parts.reduce((acc, part) => asNumber(acc) + asNumber(part)) : 0,
        }
      }

      case 'execute': {
        const query = renderQuery(node.args, scope, generators)
        return this.#withQuerySpanAndEvent(query, queryable, async () => {
          return { value: await queryable.executeRaw(query) }
        })
      }

      case 'query': {
        const query = renderQuery(node.args, scope, generators)
        return this.#withQuerySpanAndEvent(query, queryable, async () => {
          const result = await queryable.queryRaw(query)
          if (node.args.type === 'rawSql') {
            return { value: this.#rawSerializer(result), lastInsertId: result.lastInsertId }
          } else {
            return { value: this.#serializer(result), lastInsertId: result.lastInsertId }
          }
        })
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
        const transactionInfo = await transactionManager.startTransaction()
        const transaction = transactionManager.getTransaction(transactionInfo, 'query')
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
        return { value: undefined }
      }

      case 'diff': {
        const { value: from } = await this.interpretNode(node.args.from, queryable, scope, generators)
        const { value: to } = await this.interpretNode(node.args.to, queryable, scope, generators)
        const toSet = new Set(asList(to))
        return { value: asList(from).filter((item) => !toSet.has(item)) }
      }

      case 'distinctBy': {
        const { value, lastInsertId } = await this.interpretNode(node.args.expr, queryable, scope, generators)
        const seen = new Set()
        const result: Value[] = []
        for (const item of asList(value)) {
          const key = getRecordKey(item!, node.args.fields)
          if (!seen.has(key)) {
            seen.add(key)
            result.push(item)
          }
        }
        return { value: result, lastInsertId }
      }

      case 'paginate': {
        const { value, lastInsertId } = await this.interpretNode(node.args.expr, queryable, scope, generators)
        const list = asList(value)

        const linkingFields = node.args.pagination.linkingFields
        if (linkingFields !== null) {
          const groupedByParent = new Map<string, Value[]>()
          for (const item of list) {
            const parentKey = getRecordKey(item!, linkingFields)
            if (!groupedByParent.has(parentKey)) {
              groupedByParent.set(parentKey, [])
            }
            groupedByParent.get(parentKey)!.push(item)
          }

          const groupList = Array.from(groupedByParent.entries())
          groupList.sort(([aId], [bId]) => (aId < bId ? -1 : aId > bId ? 1 : 0))

          return {
            value: groupList.flatMap(([, elems]) => paginate(elems as {}[], node.args.pagination)),
            lastInsertId,
          }
        }

        return { value: paginate(list as {}[], node.args.pagination), lastInsertId }
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

  #withQuerySpanAndEvent<T>(query: SqlQuery, queryable: SqlQueryable, execute: () => Promise<T>): Promise<T> {
    return withQuerySpanAndEvent({
      query,
      execute,
      provider: this.#provider ?? queryable.provider,
      tracingHelper: this.#tracingHelper,
      onQuery: this.#onQuery,
    })
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

function attachChildrenToParents(parentRecords: unknown, children: JoinExpressionWithRecords[]) {
  for (const { joinExpr, childRecords } of children) {
    const parentKeys = joinExpr.on.map(([k]) => k)
    const childKeys = joinExpr.on.map(([, k]) => k)
    const parentMap = {}

    for (const parent of Array.isArray(parentRecords) ? parentRecords : [parentRecords]) {
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

    for (const childRecord of Array.isArray(childRecords) ? childRecords : [childRecords]) {
      if (childRecord === null) {
        continue
      }

      const key = getRecordKey(asRecord(childRecord), childKeys)
      for (const parentRecord of parentMap[key] ?? []) {
        if (joinExpr.isRelationUnique) {
          parentRecord[joinExpr.parentField] = childRecord
        } else {
          parentRecord[joinExpr.parentField].push(childRecord)
        }
      }
    }
  }

  return parentRecords
}

function paginate(list: {}[], { cursor, skip, take }: Pagination): {}[] {
  const cursorIndex = cursor !== null ? list.findIndex((item) => doKeysMatch(item, cursor)) : 0
  if (cursorIndex === -1) {
    return []
  }
  const start = cursorIndex + (skip ?? 0)
  const end = take !== null ? start + take : list.length

  return list.slice(start, end)
}

/*
 * Generate a key string for a record based on the values of the specified fields.
 */
function getRecordKey(record: {}, fields: string[]): string {
  return JSON.stringify(fields.map((field) => record[field]))
}

function evalFieldInitializer(
  initializer: FieldInitializer,
  lastInsertId: string | undefined,
  scope: ScopeBindings,
  generators: GeneratorRegistrySnapshot,
): Value {
  switch (initializer.type) {
    case 'value':
      return evaluateParam(initializer.value, scope, generators)
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
      return evaluateParam(op.value, scope, generators)
    case 'add':
      return asNumber(value) + asNumber(evaluateParam(op.value, scope, generators))
    case 'subtract':
      return asNumber(value) - asNumber(evaluateParam(op.value, scope, generators))
    case 'multiply':
      return asNumber(value) * asNumber(evaluateParam(op.value, scope, generators))
    case 'divide': {
      const lhs = asNumber(value)
      const rhs = asNumber(evaluateParam(op.value, scope, generators))
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
