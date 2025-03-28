import { SqlQuery, SqlQueryable } from '@prisma/driver-adapter-utils'

import { QueryEvent } from '../events'
import { JoinExpression, QueryPlanNode } from '../QueryPlan'
import { type TransactionManager } from '../transactionManager/TransactionManager'
import { GeneratorRegistry, GeneratorRegistrySnapshot } from './generators'
import { renderQuery } from './renderQuery'
import { PrismaObject, ScopeBindings, Value } from './scope'
import { serialize } from './serialize'

export type QueryInterpreterTransactionManager = { enabled: true; manager: TransactionManager } | { enabled: false }

export type QueryInterpreterOptions = {
  transactionManager: QueryInterpreterTransactionManager
  placeholderValues: Record<string, unknown>
  onQuery?: (event: QueryEvent) => void
}

export class QueryInterpreter {
  #transactionManager: QueryInterpreterTransactionManager
  #placeholderValues: Record<string, unknown>
  #onQuery?: (event: QueryEvent) => void
  readonly #generators: GeneratorRegistry = new GeneratorRegistry()

  constructor({ transactionManager, placeholderValues, onQuery }: QueryInterpreterOptions) {
    this.#transactionManager = transactionManager
    this.#placeholderValues = placeholderValues
    this.#onQuery = onQuery
  }

  async run(queryPlan: QueryPlanNode, queryable: SqlQueryable): Promise<unknown> {
    return this.interpretNode(queryPlan, queryable, this.#placeholderValues, this.#generators.snapshot())
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
        await Promise.all(
          node.args.bindings.map(async (binding) => {
            nestedScope[binding.name] = await this.interpretNode(binding.expr, queryable, scope, generators)
          }),
        )
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
        return this.#withQueryEvent(query, async () => {
          return await queryable.executeRaw(query)
        })
      }

      case 'query': {
        const query = renderQuery(node.args, scope, generators)
        return this.#withQueryEvent(query, async () => {
          return serialize(await queryable.queryRaw(query))
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
        const transaction = transactionManager.getTransaction(transactionInfo, 'new')
        try {
          const value = await this.interpretNode(node.args, transaction, scope, generators)
          await transactionManager.commitTransaction(transactionInfo.id)
          return value
        } catch (e) {
          await transactionManager.rollbackTransaction(transactionInfo.id)
          throw e
        }
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
