import { ArgType, Arity } from '@prisma/driver-adapter-utils'

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

export type ResultNode =
  | {
      type: 'affectedRows'
    }
  | {
      type: 'object'
      fields: Record<string, ResultNode>
      serializedName: string | null
      skipNulls: boolean
    }
  | {
      type: 'field'
      dbName: string
      fieldType: FieldType
    }

export type QueryPlanBinding = {
  name: string
  expr: QueryPlanNode
}

export type QueryPlanDbQuery =
  | {
      type: 'rawSql'
      sql: string
      args: PrismaValue[]
      argTypes: ArgType[]
    }
  | {
      type: 'templateSql'
      fragments: Fragment[]
      placeholderFormat: PlaceholderFormat
      args: PrismaValue[]
      argTypes: DynamicArgType[]
      chunkable: boolean
    }

export type DynamicArgType = ArgType | { arity: 'tuple'; elements: ArgType[] }

export type Fragment =
  | { type: 'stringChunk'; chunk: string }
  | { type: 'parameter' }
  | { type: 'parameterTuple' }
  | {
      type: 'parameterTupleList'
      itemPrefix: string
      itemSeparator: string
      itemSuffix: string
      groupSeparator: string
    }

export interface PlaceholderFormat {
  prefix: string
  hasNumbering: boolean
}

export type JoinExpression = {
  child: QueryPlanNode
  on: [left: string, right: string][]
  parentField: string
  isRelationUnique: boolean
}

export type QueryPlanNode =
  | {
      type: 'value'
      args: PrismaValue
    }
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
        enums: Record<string, Record<string, string>>
      }
    }
  | {
      type: 'validate'
      args: {
        expr: QueryPlanNode
        rules: DataRule[]
      } & ValidationError
    }
  | {
      type: 'if'
      args: {
        value: QueryPlanNode
        rule: DataRule
        then: QueryPlanNode
        else: QueryPlanNode
      }
    }
  | {
      type: 'unit'
    }
  | {
      type: 'diff'
      args: {
        from: QueryPlanNode
        to: QueryPlanNode
        fields: string[]
      }
    }
  | {
      type: 'initializeRecord'
      args: {
        expr: QueryPlanNode
        fields: Record<string, FieldInitializer>
      }
    }
  | {
      type: 'mapRecord'
      args: {
        expr: QueryPlanNode
        fields: Record<string, FieldOperation>
      }
    }
  | {
      type: 'process'
      args: {
        expr: QueryPlanNode
        operations: InMemoryOps
      }
    }

export type FieldInitializer = { type: 'value'; value: PrismaValue } | { type: 'lastInsertId' }

export type FieldOperation =
  | { type: 'set'; value: PrismaValue }
  | { type: 'add'; value: PrismaValue }
  | { type: 'subtract'; value: PrismaValue }
  | { type: 'multiply'; value: PrismaValue }
  | { type: 'divide'; value: PrismaValue }

export type Pagination = {
  cursor: Record<string, PrismaValue> | null
  take: number | null
  skip: number | null
}

export type InMemoryOps = {
  pagination: Pagination | null
  distinct: string[] | null
  reverse: boolean
  linkingFields: string[] | null
  nested: Record<string, InMemoryOps>
}

export type DataRule =
  | {
      type: 'rowCountEq'
      args: number
    }
  | {
      type: 'rowCountNeq'
      args: number
    }
  | {
      type: 'affectedRowCountEq'
      args: number
    }
  | {
      type: 'never'
    }

export type ValidationError =
  | {
      error_identifier: 'RELATION_VIOLATION'
      context: {
        relation: string
        modelA: string
        modelB: string
      }
    }
  | {
      error_identifier: 'MISSING_RELATED_RECORD'
      context: {
        model: string
        relation: string
        relationType: string
        operation: string
        neededFor?: string
      }
    }
  | {
      error_identifier: 'MISSING_RECORD'
      context: {
        operation: string
      }
    }
  | {
      error_identifier: 'INCOMPLETE_CONNECT_INPUT'
      context: {
        expectedRows: number
      }
    }
  | {
      error_identifier: 'INCOMPLETE_CONNECT_OUTPUT'
      context: {
        expectedRows: number
        relation: string
        relationType: string
      }
    }
  | {
      error_identifier: 'RECORDS_NOT_CONNECTED'
      context: {
        relation: string
        parent: string
        child: string
      }
    }

export type FieldType = { arity: Arity } & FieldScalarType

export type FieldScalarType =
  | {
      type:
        | 'string'
        | 'int'
        | 'bigint'
        | 'float'
        | 'boolean'
        | 'json'
        | 'object'
        | 'datetime'
        | 'decimal'
        | 'unsupported'
    }
  | { type: 'enum'; name: string }
  | { type: 'bytes'; encoding: 'array' | 'base64' | 'hex' }
