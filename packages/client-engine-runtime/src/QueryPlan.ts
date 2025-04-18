export type PrismaValuePlaceholder = { prisma__type: 'param'; prisma__value: { name: string; type: string } }

export function isPrismaValuePlaceholder(value: unknown): value is PrismaValuePlaceholder {
  return typeof value === 'object' && value !== null && value['prisma__type'] === 'param'
}

export type PrismaValueGenerator = {
  prisma__type: 'generatorCall'
  prisma__value: { name: string; args: PrismaValue[] }
}

export function isPrismaValueGenerator(value: unknown): value is PrismaValueGenerator {
  return typeof value === 'object' && value !== null && value['prisma__type'] === 'generatorCall'
}

export type PrismaValue =
  | string
  | boolean
  | number
  | PrismaValue[]
  | null
  | Record<string, unknown>
  | PrismaValuePlaceholder
  | PrismaValueGenerator

export type PrismaValueType =
  | 'any'
  | 'string'
  | 'int'
  | 'bigInt'
  | 'float'
  | 'boolean'
  | 'decimal'
  | 'date'
  | 'object'
  | 'bytes'
  | { type: 'array'; inner: PrismaValueType }

export type ResultNode =
  | {
      type: 'object'
      fields: Record<string, ResultNode>
    }
  | {
      type: 'value'
      dbName: string
      resultType: PrismaValueType
    }

export type QueryPlanBinding = {
  name: string
  expr: QueryPlanNode
}

export type QueryPlanDbQuery =
  | {
      type: 'rawSql'
      sql: string
      params: PrismaValue[]
    }
  | {
      type: 'templateSql'
      fragments: Fragment[]
      placeholderFormat: PlaceholderFormat
      params: PrismaValue[]
    }

export type Fragment =
  | { type: 'stringChunk'; value: string }
  | { type: 'parameter' }
  | { type: 'parameterTuple' }
  | { type: 'parameterTupleList' }

export interface PlaceholderFormat {
  prefix: string
  hasNumbering: boolean
}

export type JoinExpression = {
  child: QueryPlanNode
  on: [left: string, right: string][]
  parentField: string
}

export type QueryPlanNode =
  | {
      type: 'seq'
      args: QueryPlanNode[]
    }
  | {
      type: 'get'
      args: {
        name: string
      }
    }
  | {
      type: 'let'
      args: {
        bindings: QueryPlanBinding[]
        expr: QueryPlanNode
      }
    }
  | {
      type: 'getFirstNonEmpty'
      args: {
        names: string[]
      }
    }
  | {
      type: 'query'
      args: QueryPlanDbQuery
    }
  | {
      type: 'execute'
      args: QueryPlanDbQuery
    }
  | {
      type: 'reverse'
      args: QueryPlanNode
    }
  | {
      type: 'sum'
      args: QueryPlanNode[]
    }
  | {
      type: 'concat'
      args: QueryPlanNode[]
    }
  | {
      type: 'unique'
      args: QueryPlanNode
    }
  | {
      type: 'required'
      args: QueryPlanNode
    }
  | {
      type: 'join'
      args: {
        parent: QueryPlanNode
        children: JoinExpression[]
      }
    }
  | {
      type: 'mapField'
      args: {
        field: string
        records: QueryPlanNode
      }
    }
  | {
      type: 'transaction'
      args: QueryPlanNode
    }
  | {
      type: 'dataMap'
      args: {
        expr: QueryPlanNode
        structure: ResultNode
      }
    }
