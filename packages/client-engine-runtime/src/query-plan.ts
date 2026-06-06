import type { ArgScalarType, ArgType, Arity } from '@prisma/driver-adapter-utils'

export type PrismaValuePlaceholder = LegacyPrismaValuePlaceholder | CompactPrismaValuePlaceholder
export type LegacyPrismaValuePlaceholder = { prisma__type: 'param'; prisma__value: { name: string; type: string } }
export type CompactPrismaValuePlaceholder = { $p: readonly [name: string, type: string] }

export function isPrismaValuePlaceholder(value: unknown): value is PrismaValuePlaceholder {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const obj = value as Record<string, unknown>

  if (obj.prisma__type === 'param') {
    const prismaValue = obj.prisma__value
    return (
      typeof prismaValue === 'object' &&
      prismaValue !== null &&
      typeof (prismaValue as Record<string, unknown>).name === 'string' &&
      typeof (prismaValue as Record<string, unknown>).type === 'string'
    )
  }

  const compact = obj.$p
  return (
    Array.isArray(compact) && compact.length === 2 && typeof compact[0] === 'string' && typeof compact[1] === 'string'
  )
}

export function getPrismaValuePlaceholderName(value: PrismaValuePlaceholder): string {
  return '$p' in value ? value.$p[0] : value.prisma__value.name
}

export function getPrismaValuePlaceholderType(value: PrismaValuePlaceholder): string {
  return '$p' in value ? value.$p[1] : value.prisma__value.type
}

export type PrismaValueGenerator = LegacyPrismaValueGenerator | CompactPrismaValueGenerator

export type LegacyPrismaValueGenerator = {
  prisma__type: 'generatorCall'
  prisma__value: { name: string; args: PrismaValue[] }
}

export type CompactPrismaValueGenerator = { $g: readonly [name: string, args: PrismaValue[]] }

export function isPrismaValueGenerator(value: unknown): value is PrismaValueGenerator {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const obj = value as Record<string, unknown>

  if (obj.prisma__type === 'generatorCall') {
    const prismaValue = obj.prisma__value
    return (
      typeof prismaValue === 'object' &&
      prismaValue !== null &&
      typeof (prismaValue as Record<string, unknown>).name === 'string' &&
      Array.isArray((prismaValue as Record<string, unknown>).args)
    )
  }

  const compact = obj.$g
  return Array.isArray(compact) && compact.length === 2 && typeof compact[0] === 'string' && Array.isArray(compact[1])
}

export function getPrismaValueGeneratorName(value: PrismaValueGenerator): string {
  return '$g' in value ? value.$g[0] : value.prisma__value.name
}

export function getPrismaValueGeneratorArgs(value: PrismaValueGenerator): PrismaValue[] {
  return '$g' in value ? value.$g[1] : value.prisma__value.args
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
  | FieldScalarTypeName
  | {
      type: 'affectedRows'
    }
  | ResultObjectNode
  | CompactResultObjectNode
  | {
      type?: 'field'
      dbName?: string
      fieldType: FieldType
    }

export type ResultObjectNode = {
  type: 'object'
  fields: Record<string, ResultNode>
  serializedName: string | null
  skipNulls: boolean
}

export type CompactResultObjectNode =
  | readonly [serializedName: string | null, fields: Record<string, ResultNode>]
  | readonly [serializedName: string | null, fields: Record<string, ResultNode>, skipNulls: boolean]

export type QueryPlanBinding = LegacyQueryPlanBinding | CompactQueryPlanBinding

export type LegacyQueryPlanBinding = {
  name: string
  expr: QueryPlanNode
}

export type CompactQueryPlanBinding = readonly [name: string, expr: QueryPlanNode]

export function getQueryPlanBindingName(binding: QueryPlanBinding): string {
  return 'name' in binding ? binding.name : binding[0]
}

export function getQueryPlanBindingExpr(binding: QueryPlanBinding): QueryPlanNode {
  return 'expr' in binding ? binding.expr : binding[1]
}

export type QueryPlanDbQuery = QueryPlanRawSql | QueryPlanTemplateSql | QueryPlanCompactTemplateSql

export type QueryPlanRawSql = {
  type: 'rawSql'
  sql: string
  args: PrismaValue[]
  argTypes: ArgType[]
}

export type QueryPlanTemplateSql = {
  type: 'templateSql'
  fragments: Fragment[]
  placeholderFormat: PlaceholderFormat
  args: PrismaValue[]
  argTypes: DynamicArgType[]
  chunkable: boolean
}

export type QueryPlanCompactTemplateSql = readonly [
  fragments: Fragment[],
  placeholderFormat: CompactPlaceholderFormat,
  args: PrismaValue[],
  argTypes: DynamicArgType[],
  chunkable: boolean,
]

export type QueryPlanArgType = ArgScalarType | CompactNativeArgType | ArgType

export type CompactNativeArgType = readonly [scalarType: ArgScalarType, dbType: string]

export type DynamicArgType = QueryPlanArgType | { arity: 'tuple'; elements: QueryPlanArgType[] }

export type Fragment =
  | string
  | null
  | CompactParameterTupleFragment
  | CompactParameterTupleListFragment
  | { type: 'stringChunk'; chunk: string }
  | { type: 'parameter' }
  | {
      type: 'parameterTuple'
      itemPrefix: string
      itemSeparator: string
      itemSuffix: string
    }
  | {
      type: 'parameterTupleList'
      itemPrefix: string
      itemSeparator: string
      itemSuffix: string
      groupSeparator: string
    }

export type CompactParameterTupleFragment = readonly [
  type: 'T',
  itemPrefix: string,
  itemSeparator: string,
  itemSuffix: string,
]

export type CompactParameterTupleListFragment = readonly [
  type: 'L',
  itemPrefix: string,
  itemSeparator: string,
  itemSuffix: string,
  groupSeparator: string,
]

export interface PlaceholderFormat {
  prefix: string
  hasNumbering: boolean
}

export type CompactPlaceholderFormat = readonly [prefix: string, hasNumbering: boolean]

export type JoinExpression = LegacyJoinExpression | CompactJoinExpression

export type LegacyJoinExpression = {
  child: QueryPlanNode
  on: [left: string, right: string][]
  parentField: string
  isRelationUnique: boolean
}

export type CompactJoinExpression = readonly [
  child: QueryPlanNode,
  on: [left: string, right: string][],
  parentField: string,
  isRelationUnique: boolean,
]

export function getJoinExpressionChild(join: JoinExpression): QueryPlanNode {
  return 'child' in join ? join.child : join[0]
}

export function getJoinExpressionOn(join: JoinExpression): [left: string, right: string][] {
  return 'on' in join ? join.on : join[1]
}

export function getJoinExpressionParentField(join: JoinExpression): string {
  return 'parentField' in join ? join.parentField : join[2]
}

export function getJoinExpressionIsRelationUnique(join: JoinExpression): boolean {
  return 'isRelationUnique' in join ? join.isRelationUnique : join[3]
}

export type QueryPlanNode = QueryPlanLegacyNode | QueryPlanCompactNode

export type QueryPlanLegacyNode =
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
        canAssumeStrictEquality: boolean
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

export type QueryPlanCompactNode =
  | readonly ['v', PrismaValue]
  | readonly ['s', QueryPlanNode[]]
  | readonly ['g', string]
  | readonly ['l', QueryPlanBinding[], QueryPlanNode]
  | readonly ['e', string[]]
  | readonly ['q', QueryPlanDbQuery]
  | readonly ['x', QueryPlanDbQuery]
  | readonly ['R', QueryPlanNode]
  | readonly ['+', QueryPlanNode[]]
  | readonly ['c', QueryPlanNode[]]
  | readonly ['u', QueryPlanNode]
  | readonly ['r', QueryPlanNode]
  | readonly ['j', QueryPlanNode, JoinExpression[], boolean]
  | readonly ['m', string, QueryPlanNode]
  | readonly ['t', QueryPlanNode]
  | readonly ['d', QueryPlanNode, ResultNode, Record<string, Record<string, string>>]
  | readonly ['V', QueryPlanNode, DataRule[], ValidationError['errorIdentifier'], ValidationError['context']]
  | readonly ['?', QueryPlanNode, DataRule, QueryPlanNode, QueryPlanNode]
  | readonly ['0']
  | readonly ['-', QueryPlanNode, QueryPlanNode, string[]]
  | readonly ['i', QueryPlanNode, Record<string, FieldInitializer>]
  | readonly ['M', QueryPlanNode, Record<string, FieldOperation>]
  | readonly ['p', QueryPlanNode, InMemoryOps]

export type FieldInitializer = { type: 'value'; value: PrismaValue } | { type: 'lastInsertId' }

export type FieldOperation =
  | { type: 'set'; value: PrismaValue }
  | { type: 'add'; value: PrismaValue }
  | { type: 'subtract'; value: PrismaValue }
  | { type: 'multiply'; value: PrismaValue }
  | { type: 'divide'; value: PrismaValue }

export type Pagination = {
  cursor?: Record<string, unknown> | null
  take?: number | null
  skip?: number | null
}

export type InMemoryOps = {
  pagination?: Pagination | null
  distinct?: string[] | null
  reverse?: boolean
  linkingFields?: string[] | null
  nested?: Record<string, InMemoryOps>
}

export type DataRule = LegacyDataRule | CompactDataRule

export type LegacyDataRule =
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

export type CompactDataRule =
  | readonly [type: '=', args: number]
  | readonly [type: '!', args: number]
  | readonly [type: 'a', args: number]
  | 'n'

export function getDataRuleType(rule: DataRule): 'rowCountEq' | 'rowCountNeq' | 'affectedRowCountEq' | 'never' {
  if (rule === 'n') {
    return 'never'
  }
  if ('type' in rule) {
    return rule.type
  }
  switch (rule[0]) {
    case '=':
      return 'rowCountEq'
    case '!':
      return 'rowCountNeq'
    case 'a':
      return 'affectedRowCountEq'
  }
  throw new Error(`Unknown compact data rule type: ${rule[0]}`)
}

export function getDataRuleArgs(rule: DataRule): number {
  if (rule === 'n') {
    throw new Error('Never data rule has no arguments')
  }
  if ('type' in rule) {
    if (rule.type !== 'never') {
      return rule.args
    }
    throw new Error('Never data rule has no arguments')
  }
  return rule[1]
}

export type ValidationError =
  | {
      errorIdentifier: 'RELATION_VIOLATION'
      context: {
        relation: string
        modelA: string
        modelB: string
      }
    }
  | {
      errorIdentifier: 'MISSING_RELATED_RECORD'
      context: {
        model: string
        relation: string
        relationType: string
        operation: string
        neededFor?: string
      }
    }
  | {
      errorIdentifier: 'MISSING_RECORD'
      context: {
        operation: string
      }
    }
  | {
      errorIdentifier: 'INCOMPLETE_CONNECT_INPUT'
      context: {
        expectedRows: number
      }
    }
  | {
      errorIdentifier: 'INCOMPLETE_CONNECT_OUTPUT'
      context: {
        expectedRows: number
        relation: string
        relationType: string
      }
    }
  | {
      errorIdentifier: 'RECORDS_NOT_CONNECTED'
      context: {
        relation: string
        parent: string
        child: string
      }
    }

export type FieldArity = Arity | 'required' | 'optional'

export type FieldType = FieldScalarTypeName | ({ arity?: FieldArity } & FieldScalarType)

export type FieldScalarTypeName =
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

export type FieldScalarType =
  | {
      type: FieldScalarTypeName
    }
  | { type: 'enum'; name: string }
  | { type: 'bytes'; encoding: 'array' | 'base64' | 'hex' }
