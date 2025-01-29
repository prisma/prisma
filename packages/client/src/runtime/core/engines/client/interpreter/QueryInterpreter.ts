import { Queryable } from '@prisma/driver-adapter-utils'
import { assertNever } from '@prisma/internals'

import { JoinExpression, QueryPlanNode } from '../QueryPlan'
import { Env, PrismaObject, Value } from './env'
import { renderQuery } from './renderQuery'
import { serialize } from './serializer'

export class QueryInterpreter {
  constructor(private queryable: Queryable, private params: Record<string, unknown>) {}

  async run(queryPlan: QueryPlanNode): Promise<unknown> {
    return this.interpretNode(queryPlan, this.params)
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
        const result = await this.queryable.executeRaw(renderQuery(node.args, env))
        if (result.ok) {
          return result.value
        } else {
          throw result.error
        }
      }

      case 'query': {
        const result = await this.queryable.queryRaw(renderQuery(node.args, env))
        if (result.ok) {
          if (result.value.kind === 'sql') {
            return serialize(result.value)
          } else if (result.value.kind === 'mongodb') {
            return result.value
          } else {
            assertNever(result.value, 'Unsupported kind of ResultSet received from driver adapter!')
            break
          }
        } else {
          throw result.error
        }
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
