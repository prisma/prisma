import { ArgType, ErrorCapturingDriverAdapter, Query } from '@prisma/driver-adapter-utils'

import { isPrismaValuePlaceholder, PrismaValue, QueryPlanDbQuery, QueryPlanNode } from '../engines/common/Engine'
import { serialize } from './serializer'

export class QueryInterpreter {
  constructor(private adapter: ErrorCapturingDriverAdapter, private params: Record<string, unknown>) {}

  async run(queryPlan: QueryPlanNode): Promise<unknown> {
    return this.interpretNode(queryPlan, this.params)
  }

  private async interpretNode(node: QueryPlanNode, env: Record<string, unknown>): Promise<unknown> {
    switch (node.type) {
      case 'Seq': {
        const results = await Promise.all(node.args.map((arg) => this.interpretNode(arg, env)))
        return results[results.length - 1]
      }

      case 'Get': {
        return env[node.args.name]
      }

      case 'Let': {
        const bindings: Record<string, unknown> = Object.create(env)
        await Promise.all(
          node.args.bindings.map(async (binding) => {
            bindings[binding.name] = await this.interpretNode(binding.expr, env)
          }),
        )
        return this.interpretNode(node.args.expr, bindings)
      }

      case 'GetFirstNonEmpty': {
        for (const name of node.args.names) {
          const value = env[name]
          if (!isEmpty(value)) {
            return value
          }
        }
        return []
      }

      case 'Concat': {
        const parts: unknown[] = await Promise.all(node.args.map((arg) => this.interpretNode(arg, env)))
        return parts.reduce<unknown[]>((acc, part) => acc.concat(asList(part)), [])
      }

      case 'Sum': {
        const parts: unknown[] = await Promise.all(node.args.map((arg) => this.interpretNode(arg, env)))
        return parts.reduce((acc, part) => asNumber(acc) + asNumber(part))
      }

      case 'Execute': {
        const result = await this.adapter.executeRaw(toQuery(node.args, env))
        if (result.ok) {
          return result.value
        } else {
          throw result.error
        }
      }

      case 'Query': {
        const result = await this.adapter.queryRaw(toQuery(node.args, env))
        if (result.ok) {
          return serialize(result.value)
        } else {
          throw result.error
        }
      }
    }
  }
}

function isEmpty(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length === 0
  }
  return value == null
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value]
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    return Number(value)
  }
  throw new Error(`Expected number, got ${typeof value}`)
}

function toQuery({ query, params }: QueryPlanDbQuery, env: Record<string, unknown>): Query {
  const args = params.map((param) => {
    if (!isPrismaValuePlaceholder(param)) {
      return param
    }
    const value = env[param.prisma__value.name]
    if (value === undefined) {
      throw new Error(`Missing value for query variable ${param.prisma__value.name}`)
    }
    return value
  })

  const argTypes = params.map((param) => toArgType(param))

  return {
    sql: query,
    args,
    argTypes,
  }
}

function toArgType(value: PrismaValue): ArgType {
  if (value === null) {
    return 'Int32' // TODO
  }

  if (typeof value === 'string') {
    return 'Text'
  }

  if (typeof value === 'number') {
    return 'Numeric'
    // if (Number.isInteger(value)) {
    //   return 'Int32'
    // } else {
    //   return 'Double'
    // }
  }

  if (typeof value === 'boolean') {
    return 'Boolean'
  }

  if (Array.isArray(value)) {
    return 'Array'
  }

  if (isPrismaValuePlaceholder(value)) {
    return placeholderTypeToArgType(value.prisma__value.type)
  }

  return 'Json'
}

function placeholderTypeToArgType(type: string): ArgType {
  const typeMap = {
    Any: 'Json',
    String: 'Text',
    Int: 'Int32',
    BigInt: 'Int64',
    Float: 'Double',
    Boolean: 'Boolean',
    Decimal: 'Numeric',
    Date: 'DateTime',
    Object: 'Json',
    Bytes: 'Bytes',
    Array: 'Array',
  } satisfies Record<string, ArgType>

  const mappedType = typeMap[type] as ArgType | undefined

  if (!mappedType) {
    throw new Error(`Unknown placeholder type: ${type}`)
  }

  return mappedType
}
