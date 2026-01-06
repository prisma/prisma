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

export type PureQueryPlanNode<Rest = never> =
  | {
      type: 'value'
      args: PrismaValue
      lastInsertId?: string
    }
  | {
      type: 'seq'
      args: (PureQueryPlanNode<Rest> | Rest)[]
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
        bindings: {
          name: string
          expr: PureQueryPlanNode<Rest> | Rest
        }[]
        expr: PureQueryPlanNode<Rest> | Rest
      }
    }
  | {
      type: 'getFirstNonEmpty'
      args: {
        names: string[]
      }
    }
  | {
      type: 'reverse'
      args: PureQueryPlanNode<Rest> | Rest
    }
  | {
      type: 'sum'
      args: (PureQueryPlanNode<Rest> | Rest)[]
    }
  | {
      type: 'concat'
      args: (PureQueryPlanNode<Rest> | Rest)[]
    }
  | {
      type: 'unique'
      args: PureQueryPlanNode<Rest> | Rest
    }
  | {
      type: 'required'
      args: PureQueryPlanNode<Rest> | Rest
    }
  | {
      type: 'join'
      args: {
        parent: PureQueryPlanNode<Rest> | Rest
        children: {
          child: PureQueryPlanNode<Rest> | Rest
          on: [left: string, right: string][]
          parentField: string
          isRelationUnique: boolean
        }[]
      }
    }
  | {
      type: 'mapField'
      args: {
        field: string
        records: PureQueryPlanNode<Rest> | Rest
      }
    }
  | {
      type: 'dataMap'
      args: {
        expr: PureQueryPlanNode<Rest> | Rest
        structure: ResultNode
        enums: Record<string, Record<string, string>>
      }
    }
  | {
      type: 'validate'
      args: {
        expr: PureQueryPlanNode<Rest> | Rest
        rules: DataRule[]
      } & ValidationError
    }
  | {
      type: 'if'
      args: {
        value: PureQueryPlanNode<Rest> | Rest
        rule: DataRule
        then: PureQueryPlanNode<Rest> | Rest
        else: PureQueryPlanNode<Rest> | Rest
      }
    }
  | {
      type: 'unit'
    }
  | {
      type: 'diff'
      args: {
        from: PureQueryPlanNode<Rest> | Rest
        to: PureQueryPlanNode<Rest> | Rest
        fields: string[]
      }
    }
  | {
      type: 'initializeRecord'
      args: {
        expr: PureQueryPlanNode<Rest> | Rest
        fields: Record<string, FieldInitializer>
      }
    }
  | {
      type: 'mapRecord'
      args: {
        expr: PureQueryPlanNode<Rest> | Rest
        fields: Record<string, FieldOperation>
      }
    }
  | {
      type: 'process'
      args: {
        expr: PureQueryPlanNode<Rest> | Rest
        operations: InMemoryOps
      }
    }

export type ImpureQueryPlanNode =
  | {
      type: 'query'
      args: QueryPlanDbQuery
    }
  | {
      type: 'execute'
      args: QueryPlanDbQuery
    }
  | {
      type: 'transaction'
      args: QueryPlanNode
    }

export type QueryPlanNode = ImpureQueryPlanNode | PureQueryPlanNode<ImpureQueryPlanNode>

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
