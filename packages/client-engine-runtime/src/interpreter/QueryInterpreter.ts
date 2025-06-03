import { SqlQuery, SqlQueryable, SqlResultSet } from '@prisma/driver-adapter-utils'

import { QueryEvent } from '../events'
import { JoinExpression, Pagination, QueryPlanNode } from '../QueryPlan'
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
}

export class QueryInterpreter {
  readonly #transactionManager: QueryInterpreterTransactionManager
  readonly #placeholderValues: Record<string, unknown>
  readonly #onQuery?: (event: QueryEvent) => void
  readonly #generators: GeneratorRegistry = new GeneratorRegistry()
  readonly #tracingHelper: TracingHelper
  readonly #serializer: (results: SqlResultSet) => Value
  readonly #rawSerializer: (results: SqlResultSet) => Value

  constructor({
    transactionManager,
    placeholderValues,
    onQuery,
    tracingHelper,
    serializer,
    rawSerializer,
  }: QueryInterpreterOptions) {
    this.#transactionManager = transactionManager
    this.#placeholderValues = placeholderValues
    this.#onQuery = onQuery
    this.#tracingHelper = tracingHelper
    this.#serializer = serializer
    this.#rawSerializer = rawSerializer ?? serializer
  }

  static forSql(options: {
    transactionManager: QueryInterpreterTransactionManager
    placeholderValues: Record<string, unknown>
    onQuery?: (event: QueryEvent) => void
    tracingHelper: TracingHelper
  }): QueryInterpreter {
    return new QueryInterpreter({
      transactionManager: options.transactionManager,
      placeholderValues: options.placeholderValues,
      onQuery: options.onQuery,
      tracingHelper: options.tracingHelper,
      serializer: serializeSql,
      rawSerializer: serializeRawSql,
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

        if (Array.isArray(parent)) {
          for (const record of parent) {
            attachChildrenToParent(asRecord(record), children)
          }
          return { value: parent, lastInsertId }
        }

        return { value: attachChildrenToParent(asRecord(parent), children), lastInsertId }
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

      case 'extendRecord': {
        const { value, lastInsertId } = await this.interpretNode(node.args.expr, queryable, scope, generators)
        const record = value === null ? {} : asRecord(value)

        for (const [key, entry] of Object.entries(node.args.values)) {
          if (entry.type === 'lastInsertId') {
            record[key] = lastInsertId
          } else {
            record[key] = evaluateParam(entry.value, scope, generators)
          }
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
      queryable,
      execute,
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

function attachChildrenToParent(parentRecord: PrismaObject, children: JoinExpressionWithRecords[]) {
  for (const { joinExpr, childRecords } of children) {
    parentRecord[joinExpr.parentField] = filterChildRecords(childRecords, parentRecord, joinExpr)
  }
  return parentRecord
}

function filterChildRecords(records: Value, parentRecord: PrismaObject, joinExpr: JoinExpression) {
  if (Array.isArray(records)) {
    const filtered = records.filter((record) => childRecordMatchesParent(asRecord(record), parentRecord, joinExpr))
    if (joinExpr.isRelationUnique) {
      return filtered.length > 0 ? filtered[0] : null
    } else {
      return filtered
    }
  } else if (records === null) {
    // we can get here in case of a join with a missing UNIQUE node
    return null
  } else {
    const record = asRecord(records)
    return childRecordMatchesParent(record, parentRecord, joinExpr) ? record : null
  }
}

function childRecordMatchesParent(
  childRecord: PrismaObject,
  parentRecord: PrismaObject,
  joinExpr: JoinExpression,
): boolean {
  for (const [parentField, childField] of joinExpr.on) {
    if (parentRecord[parentField] !== childRecord[childField]) {
      return false
    }
  }
  return true
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
