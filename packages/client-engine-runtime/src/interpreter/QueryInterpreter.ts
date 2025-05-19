import { SpanKind } from '@opentelemetry/api'
import { SqlQuery, SqlQueryable, SqlResultSet } from '@prisma/driver-adapter-utils'

import { QueryEvent } from '../events'
import { JoinExpression, Pagination, QueryPlanNode } from '../QueryPlan'
import { providerToOtelSystem, type TracingHelper } from '../tracing'
import { type TransactionManager } from '../transactionManager/TransactionManager'
import { rethrowAsUserFacing } from '../UserFacingError'
import { assertNever, isDeepStrictEqual } from '../utils'
import { applyDataMap } from './DataMapper'
import { GeneratorRegistry, GeneratorRegistrySnapshot } from './generators'
import { renderQuery } from './renderQuery'
import { PrismaObject, ScopeBindings, Value } from './scope'
import { serializeSql } from './serializeSql'
import { doesSatisfyRule, performValidation } from './validation'

export type QueryInterpreterTransactionManager = { enabled: true; manager: TransactionManager } | { enabled: false }

export type QueryInterpreterOptions = {
  transactionManager: QueryInterpreterTransactionManager
  placeholderValues: Record<string, unknown>
  onQuery?: (event: QueryEvent) => void
  tracingHelper: TracingHelper
  serializer: (results: SqlResultSet) => Value
}

export class QueryInterpreter {
  readonly #transactionManager: QueryInterpreterTransactionManager
  readonly #placeholderValues: Record<string, unknown>
  readonly #onQuery?: (event: QueryEvent) => void
  readonly #generators: GeneratorRegistry = new GeneratorRegistry()
  readonly #tracingHelper: TracingHelper
  readonly #serializer: (results: SqlResultSet) => Value

  constructor({ transactionManager, placeholderValues, onQuery, tracingHelper, serializer }: QueryInterpreterOptions) {
    this.#transactionManager = transactionManager
    this.#placeholderValues = placeholderValues
    this.#onQuery = onQuery
    this.#tracingHelper = tracingHelper
    this.#serializer = serializer
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
    })
  }

  async run(queryPlan: QueryPlanNode, queryable: SqlQueryable): Promise<unknown> {
    return this.interpretNode(queryPlan, queryable, this.#placeholderValues, this.#generators.snapshot()).catch((e) =>
      rethrowAsUserFacing(e),
    )
  }

  private async interpretNode(
    node: QueryPlanNode,
    queryable: SqlQueryable,
    scope: ScopeBindings,
    generators: GeneratorRegistrySnapshot,
  ): Promise<Value> {
    switch (node.type) {
      case 'seq': {
        const results = await Promise.all(node.args.map((arg) => this.interpretNode(arg, queryable, scope, generators)))
        return results[results.length - 1]
      }

      case 'get': {
        return scope[node.args.name]
      }

      case 'let': {
        const nestedScope: ScopeBindings = Object.create(scope)
        for (const binding of node.args.bindings) {
          nestedScope[binding.name] = await this.interpretNode(binding.expr, queryable, nestedScope, generators)
        }
        return this.interpretNode(node.args.expr, queryable, nestedScope, generators)
      }

      case 'getFirstNonEmpty': {
        for (const name of node.args.names) {
          const value = scope[name]
          if (!isEmpty(value)) {
            return value
          }
        }
        return []
      }

      case 'concat': {
        const parts = await Promise.all(node.args.map((arg) => this.interpretNode(arg, queryable, scope, generators)))
        return parts.reduce<Value[]>((acc, part) => acc.concat(asList(part)), [])
      }

      case 'sum': {
        const parts = await Promise.all(node.args.map((arg) => this.interpretNode(arg, queryable, scope, generators)))
        return parts.reduce((acc, part) => asNumber(acc) + asNumber(part))
      }

      case 'execute': {
        const query = renderQuery(node.args, scope, generators)
        return this.#withQueryEvent(query, queryable, async () => {
          return await queryable.executeRaw(query)
        })
      }

      case 'query': {
        const query = renderQuery(node.args, scope, generators)
        return this.#withQueryEvent(query, queryable, async () => {
          return this.#serializer(await queryable.queryRaw(query))
        })
      }

      case 'reverse': {
        const value = await this.interpretNode(node.args, queryable, scope, generators)
        return Array.isArray(value) ? value.reverse() : value
      }

      case 'unique': {
        const value = await this.interpretNode(node.args, queryable, scope, generators)
        if (!Array.isArray(value)) {
          return value
        }
        if (value.length > 1) {
          throw new Error(`Expected zero or one element, got ${value.length}`)
        }
        return value[0] ?? null
      }

      case 'required': {
        const value = await this.interpretNode(node.args, queryable, scope, generators)
        if (isEmpty(value)) {
          throw new Error('Required value is empty')
        }
        return value
      }

      case 'mapField': {
        const value = await this.interpretNode(node.args.records, queryable, scope, generators)
        return mapField(value, node.args.field)
      }

      case 'join': {
        const parent = await this.interpretNode(node.args.parent, queryable, scope, generators)

        const children = (await Promise.all(
          node.args.children.map(async (joinExpr) => ({
            joinExpr,
            childRecords: await this.interpretNode(joinExpr.child, queryable, scope, generators),
          })),
        )) satisfies JoinExpressionWithRecords[]

        if (Array.isArray(parent)) {
          for (const record of parent) {
            attachChildrenToParent(asRecord(record), children)
          }
          return parent
        }

        return attachChildrenToParent(asRecord(parent), children)
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
        const data = await this.interpretNode(node.args.expr, queryable, scope, generators)
        return applyDataMap(data, node.args.structure)
      }

      case 'validate': {
        const data = await this.interpretNode(node.args.expr, queryable, scope, generators)
        performValidation(data, node.args.rules, node.args)

        return data
      }

      case 'if': {
        const value = await this.interpretNode(node.args.value, queryable, scope, generators)
        if (doesSatisfyRule(value, node.args.rule)) {
          return await this.interpretNode(node.args.then, queryable, scope, generators)
        } else {
          return await this.interpretNode(node.args.else, queryable, scope, generators)
        }
      }

      case 'unit': {
        return undefined
      }

      case 'diff': {
        const from = await this.interpretNode(node.args.from, queryable, scope, generators)
        const to = await this.interpretNode(node.args.to, queryable, scope, generators)
        const toSet = new Set(asList(to))
        return asList(from).filter((item) => !toSet.has(item))
      }

      case 'distinctBy': {
        const value = await this.interpretNode(node.args.expr, queryable, scope, generators)
        const seen = new Set()
        const result: Value[] = []
        for (const item of asList(value)) {
          const key = getRecordKey(item!, node.args.fields)
          if (!seen.has(key)) {
            seen.add(key)
            result.push(item)
          }
        }
        return result
      }

      case 'paginate': {
        const value = await this.interpretNode(node.args.expr, queryable, scope, generators)
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

          return groupList.flatMap(([, elems]) => paginate(elems as {}[], node.args.pagination))
        }

        return paginate(list as {}[], node.args.pagination)
      }

      default:
        assertNever(node, `Unexpected node type: ${(node as { type: unknown }).type}`)
    }
  }

  #withQueryEvent<T>(query: SqlQuery, queryable: SqlQueryable, execute: () => Promise<T>): Promise<T> {
    return this.#tracingHelper.runInChildSpan(
      {
        name: 'db_query',
        kind: SpanKind.CLIENT,
        attributes: {
          'db.query.text': query.sql,
          'db.system.name': providerToOtelSystem(queryable.provider),
        },
      },
      async () => {
        const timestamp = new Date()
        const startInstant = performance.now()
        const result = await execute()
        const endInstant = performance.now()

        this.#onQuery?.({
          timestamp,
          duration: endInstant - startInstant,
          query: query.sql,
          params: query.args,
        })

        return result
      },
    )
  }
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

function attachChildrenToParent(parentRecord: PrismaObject, children: JoinExpressionWithRecords[]) {
  for (const { joinExpr, childRecords } of children) {
    parentRecord[joinExpr.parentField] = filterChildRecords(childRecords, parentRecord, joinExpr)
  }
  return parentRecord
}

function filterChildRecords(records: Value, parentRecord: PrismaObject, joinExpr: JoinExpression) {
  if (Array.isArray(records)) {
    return records.filter((record) => childRecordMatchesParent(asRecord(record), parentRecord, joinExpr))
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
  const cursorIndex = cursor !== null ? list.findIndex((item) => doesMatchCursor(item, cursor)) : 0
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

function doesMatchCursor(item: {}, cursor: Record<string, unknown>): boolean {
  return Object.keys(cursor).every((key) => {
    // explicitly check for string to avoid issues with numeric types stored as strings in SQLite,
    // we might need to come up with a better way of handling this
    if (typeof item[key] !== typeof cursor[key] && (typeof item[key] === 'number' || typeof cursor[key] === 'number')) {
      return `${item[key]}` === `${cursor[key]}`
    }

    return isDeepStrictEqual(cursor[key], item[key])
  })
}
