import type { ErrorCapturingSqlQueryable, SqlQuery } from '@prisma/driver-adapter-utils'

import type { QueryEvent } from '../events'
import type { JoinExpression, QueryPlanNode } from '../QueryPlan'
import { renderQuery } from './renderQuery'
import type { PrismaObject, ScopeBindings, Value } from './scope'
import { serialize } from './serialize'

export type QueryInterpreterOptions = {
  queryable: ErrorCapturingSqlQueryable
  placeholderValues: Record<string, unknown>
  onQuery?: (event: QueryEvent) => void
}

export class QueryInterpreter {
  #queryable: ErrorCapturingSqlQueryable
  #placeholderValues: Record<string, unknown>
  #onQuery?: (event: QueryEvent) => void

  constructor({ queryable, placeholderValues, onQuery }: QueryInterpreterOptions) {
    this.#queryable = queryable
    this.#placeholderValues = placeholderValues
    this.#onQuery = onQuery
  }

  async run(queryPlan: QueryPlanNode): Promise<unknown> {
    return this.interpretNode(queryPlan, this.#placeholderValues)
  }

  private async interpretNode(node: QueryPlanNode, scope: ScopeBindings): Promise<Value> {
    switch (node.type) {
      case 'seq': {
        const results = await Promise.all(node.args.map((arg) => this.interpretNode(arg, scope)))
        return results[results.length - 1]
      }

      case 'get': {
        return scope[node.args.name]
      }

      case 'let': {
        const nestedScope: ScopeBindings = Object.create(scope)
        await Promise.all(
          node.args.bindings.map(async (binding) => {
            nestedScope[binding.name] = await this.interpretNode(binding.expr, scope)
          }),
        )
        return this.interpretNode(node.args.expr, nestedScope)
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
        const parts = await Promise.all(node.args.map((arg) => this.interpretNode(arg, scope)))
        return parts.reduce<Value[]>((acc, part) => acc.concat(asList(part)), [])
      }

      case 'sum': {
        const parts = await Promise.all(node.args.map((arg) => this.interpretNode(arg, scope)))
        return parts.reduce((acc, part) => asNumber(acc) + asNumber(part))
      }

      case 'execute': {
        const query = renderQuery(node.args, scope)
        return this.#withQueryEvent(query, async () => {
          const result = await this.#queryable.executeRaw(query)
          if (result.ok) {
            return result.value
          }
            throw result.error
        })
      }

      case 'query': {
        const query = renderQuery(node.args, scope)
        return this.#withQueryEvent(query, async () => {
          const result = await this.#queryable.queryRaw(query)
          if (result.ok) {
            return serialize(result.value)
          }
            throw result.error
        })
      }

      case 'reverse': {
        const value = await this.interpretNode(node.args, scope)
        return Array.isArray(value) ? value.reverse() : value
      }

      case 'unique': {
        const value = await this.interpretNode(node.args, scope)
        if (!Array.isArray(value)) {
          return value
        }
        if (value.length > 1) {
          throw new Error(`Expected zero or one element, got ${value.length}`)
        }
        return value[0] ?? null
      }

      case 'required': {
        const value = await this.interpretNode(node.args, scope)
        if (isEmpty(value)) {
          throw new Error('Required value is empty')
        }
        return value
      }

      case 'mapField': {
        const value = await this.interpretNode(node.args.records, scope)
        return mapField(value, node.args.field)
      }

      case 'join': {
        const parent = await this.interpretNode(node.args.parent, scope)

        const children = (await Promise.all(
          node.args.children.map(async (joinExpr) => ({
            joinExpr,
            childRecords: await this.interpretNode(joinExpr.child, scope),
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

      default: {
        node satisfies never
        throw new Error(`Unexpected node type: ${(node as { type: unknown }).type}`)
      }
    }
  }

  async #withQueryEvent<T>(query: SqlQuery, execute: () => Promise<T>): Promise<T> {
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
  }
    const record = asRecord(records)
    return childRecordMatchesParent(record, parentRecord, joinExpr) ? record : null
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
