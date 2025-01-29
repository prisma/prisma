import { Query, Queryable } from '@prisma/driver-adapter-utils'

import { QueryEvent } from '../../common/types/Events'
import { JoinExpression, QueryPlanNode } from '../QueryPlan'
import { Env, PrismaObject, Value } from './env'
import { renderQuery } from './renderQuery'
import { serialize } from './serializer'

export type QueryInterpreterOptions = {
  queryable: Queryable
  placeholderValues: Record<string, unknown>
  onQuery?: (event: QueryEvent) => void
}

export class QueryInterpreter {
  #queryable: Queryable
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

  private async interpretNode(node: QueryPlanNode, env: Env): Promise<Value> {
    switch (node.type) {
      case 'seq': {
        const results = await Promise.all(node.args.map((arg) => this.interpretNode(arg, env)))
        return results[results.length - 1]
      }

      case 'get': {
        return env[node.args.name]
      }

      case 'let': {
        const bindings: Env = Object.create(env)
        await Promise.all(
          node.args.bindings.map(async (binding) => {
            bindings[binding.name] = await this.interpretNode(binding.expr, env)
          }),
        )
        return this.interpretNode(node.args.expr, bindings)
      }

      case 'getFirstNonEmpty': {
        for (const name of node.args.names) {
          const value = env[name]
          if (!isEmpty(value)) {
            return value
          }
        }
        return []
      }

      case 'concat': {
        const parts = await Promise.all(node.args.map((arg) => this.interpretNode(arg, env)))
        return parts.reduce<Value[]>((acc, part) => acc.concat(asList(part)), [])
      }

      case 'sum': {
        const parts = await Promise.all(node.args.map((arg) => this.interpretNode(arg, env)))
        return parts.reduce((acc, part) => asNumber(acc) + asNumber(part))
      }

      case 'execute': {
        const query = renderQuery(node.args, env)
        return this.#withQueryEvent(query, async () => {
          const result = await this.#queryable.executeRaw(query)
          if (result.ok) {
            return result.value
          } else {
            throw result.error
          }
        })
      }

      case 'query': {
        const query = renderQuery(node.args, env)
        return this.#withQueryEvent(query, async () => {
          const result = await this.#queryable.queryRaw(query)
          if (result.ok) {
            return serialize(result.value)
          } else {
            throw result.error
          }
        })
      }

      case 'reverse': {
        const value = await this.interpretNode(node.args, env)
        return Array.isArray(value) ? value.reverse() : value
      }

      case 'unique': {
        const value = await this.interpretNode(node.args, env)
        if (!Array.isArray(value)) {
          return value
        }
        if (value.length !== 1) {
          throw new Error(`Expected exactly one element, got ${value.length}`)
        }
        return value[0]
      }

      case 'required': {
        const value = await this.interpretNode(node.args, env)
        if (isEmpty(value)) {
          throw new Error('Required value is empty')
        }
        return value
      }

      case 'mapField': {
        const value = await this.interpretNode(node.args.records, env)
        return mapField(value, node.args.field)
      }

      case 'join': {
        const parent = await this.interpretNode(node.args.parent, env)

        const children = (await Promise.all(
          node.args.children.map(async (joinExpr) => ({
            joinExpr,
            childRecords: await this.interpretNode(joinExpr.child, env),
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

  async #withQueryEvent<T>(query: Query, execute: () => Promise<T>): Promise<T> {
    const timestamp = new Date()
    const startInstant = performance.now()
    const result = await execute()
    const endInstant = performance.now()

    this.#onQuery?.({
      timestamp,
      duration: endInstant - startInstant,
      query: query.sql,
      // TODO: we should probably change the interface to contain a proper array in the next major version.
      params: JSON.stringify(query.args),
      // TODO: this field only exists for historical reasons as we grandfathered it from the time
      // when we emitted `tracing` events to stdout in the engine unchanged, and then described
      // them in the public API as TS types. Thus this field used to contain the name of the Rust
      // module in which an event originated. When using library engine, which uses a different
      // mechanism with a JavaScript callback for logs, it's normally just an empty string instead.
      // This field is definitely not useful and should be removed from the public types (but it's
      // technically a breaking change, even if a tiny and inconsequential one).
      target: 'QueryInterpreter',
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
