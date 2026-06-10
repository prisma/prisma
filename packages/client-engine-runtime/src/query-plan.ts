import type { ArgScalarType, ArgType, Arity } from '@prisma/driver-adapter-utils'

export type PrismaValuePlaceholder = { $p: readonly [name: string, type: string] }

export function isPrismaValuePlaceholder(value: unknown): value is PrismaValuePlaceholder {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const obj = value as Record<string, unknown>
  const compact = obj.$p
  return (
    Array.isArray(compact) && compact.length === 2 && typeof compact[0] === 'string' && typeof compact[1] === 'string'
  )
}

export function getPrismaValuePlaceholderName(value: PrismaValuePlaceholder): string {
  return value.$p[0]
}

export function getPrismaValuePlaceholderType(value: PrismaValuePlaceholder): string {
  return value.$p[1]
}

export type PrismaValueGenerator = { $g: readonly [name: string, args: PrismaValue[]] }

export function isPrismaValueGenerator(value: unknown): value is PrismaValueGenerator {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const obj = value as Record<string, unknown>
  const compact = obj.$g
  return Array.isArray(compact) && compact.length === 2 && typeof compact[0] === 'string' && Array.isArray(compact[1])
}

export function getPrismaValueGeneratorName(value: PrismaValueGenerator): string {
  return value.$g[0]
}

export function getPrismaValueGeneratorArgs(value: PrismaValueGenerator): PrismaValue[] {
  return value.$g[1]
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
  | CompactResultObjectNode
  | {
      type?: 'field'
      dbName?: string
      fieldType: FieldType
    }

export type CompactResultObjectNode =
  | readonly [serializedName: string | null, fields: Record<string, ResultNode>]
  | readonly [serializedName: string | null, fields: Record<string, ResultNode>, skipNulls: boolean]

export type QueryPlanBinding = readonly [name: string, expr: QueryPlanNode]

export function getQueryPlanBindingName(binding: QueryPlanBinding): string {
  return binding[0]
}

export function getQueryPlanBindingExpr(binding: QueryPlanBinding): QueryPlanNode {
  return binding[1]
}

export type QueryPlanDbQuery = QueryPlanRawSql | QueryPlanCompactTemplateSql

export type QueryPlanRawSql = {
  type: 'rawSql'
  sql: string
  args: PrismaValue[]
  argTypes: ArgType[]
}

export type QueryPlanCompactTemplateSql = readonly [
  fragments: Fragment[],
  placeholderFormat: CompactPlaceholderFormat,
  args: PrismaValue[],
  argTypes: DynamicArgType[],
  chunkable: boolean,
]

export type CompactArgScalarType = 's' | 'i' | 'I' | 'f' | 'd' | 'b' | 'e' | 'u' | 'j' | 'D' | 'B' | '?'

export type QueryPlanArgScalarType = ArgScalarType | CompactArgScalarType

export type QueryPlanArgType = QueryPlanArgScalarType | CompactNativeArgType | ArgType

export type CompactNativeArgType = readonly [scalarType: QueryPlanArgScalarType, dbType: string]

export type DynamicArgType = QueryPlanArgType | { arity: 'tuple'; elements: QueryPlanArgType[] }

export type Fragment = string | null | CompactParameterTupleFragment | CompactParameterTupleListFragment

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

export type CompactPlaceholderFormat = readonly [prefix: string, hasNumbering: boolean]

export type JoinExpression = readonly [
  child: QueryPlanNode,
  on: [left: string, right: string][],
  parentField: string,
  isRelationUnique: boolean,
]

export type CompactJoinExpression = JoinExpression

export function getJoinExpressionChild(join: JoinExpression): QueryPlanNode {
  return join[0]
}

export function getJoinExpressionOn(join: JoinExpression): [left: string, right: string][] {
  return join[1]
}

export function getJoinExpressionParentField(join: JoinExpression): string {
  return join[2]
}

export function getJoinExpressionIsRelationUnique(join: JoinExpression): boolean {
  return join[3]
}

export type RawResultColumnRef = number | string

export type RawResultColumnMapping = readonly [
  fieldName: string | readonly string[],
  column: RawResultColumnRef,
  fieldType?: FieldType,
]

export type RawNestedReadQuery = readonly [
  query: QueryPlanDbQuery,
  fields: readonly RawResultColumnMapping[],
  relations?: readonly RawNestedReadRelation[],
]

export type RawNestedReadRelation = RawNestedReadDirectRelation | RawNestedReadManyToManyRelation

export type RawNestedReadDirectRelation = readonly [
  type: 'r',
  fieldName: string,
  child: RawNestedReadQuery,
  parentColumn: RawResultColumnRef,
  childColumn: RawResultColumnRef,
  scopeName: string,
  isRelationUnique: boolean,
]

export type RawNestedReadManyToManyRelation = readonly [
  type: 'm',
  fieldName: string,
  joinQuery: QueryPlanDbQuery,
  child: RawNestedReadQuery,
  parentColumn: RawResultColumnRef,
  joinParentColumn: RawResultColumnRef,
  joinChildColumn: RawResultColumnRef,
  childColumn: RawResultColumnRef,
  joinScopeName: string,
  childScopeName: string,
]

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
  | readonly ['d', QueryPlanNode, ResultNode]
  | readonly ['d', QueryPlanNode, ResultNode, Record<string, Record<string, string>>]
  | readonly ['V', QueryPlanNode, DataRule[], QueryPlanValidationErrorIdentifier, QueryPlanValidationErrorContext]
  | readonly ['?', QueryPlanNode, DataRule, QueryPlanNode, QueryPlanNode]
  | readonly ['0']
  | readonly ['-', QueryPlanNode, QueryPlanNode, string[]]
  | readonly ['i', QueryPlanNode, Record<string, FieldInitializer>]
  | readonly ['M', QueryPlanNode, Record<string, FieldOperation>]
  | readonly ['p', QueryPlanNode, InMemoryOps]
  | readonly ['n', RawNestedReadQuery, unique: boolean, enums?: Record<string, Record<string, string>>]

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

export type DataRule =
  | readonly [type: '=', args: number]
  | readonly [type: '!', args: number]
  | readonly [type: 'a', args: number]
  | 'n'

export function getDataRuleType(rule: DataRule): 'rowCountEq' | 'rowCountNeq' | 'affectedRowCountEq' | 'never' {
  if (rule === 'n') {
    return 'never'
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
  return rule[1]
}

export type CompactValidationErrorIdentifier = 'r' | 'm' | 'M' | 'i' | 'o' | 'n'

export type QueryPlanValidationErrorIdentifier = CompactValidationErrorIdentifier

export type QueryPlanValidationErrorContext =
  | readonly [relation: string, modelA: string, modelB: string]
  | readonly [model: string, relation: string, relationType: string, operation: string, neededFor?: string]
  | string
  | number
  | readonly [expectedRows: number, relation: string, relationType: string]
  | readonly [relation: string, parent: string, child: string]

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

export function getValidationError(
  errorIdentifier: QueryPlanValidationErrorIdentifier,
  context: QueryPlanValidationErrorContext,
): ValidationError {
  switch (errorIdentifier) {
    case 'r': {
      const [relation, modelA, modelB] = context as readonly [string, string, string]
      return { errorIdentifier: 'RELATION_VIOLATION', context: { relation, modelA, modelB } }
    }
    case 'm': {
      const [model, relation, relationType, operation, neededFor] = context as readonly [
        string,
        string,
        string,
        string,
        string | undefined,
      ]
      return {
        errorIdentifier: 'MISSING_RELATED_RECORD',
        context:
          neededFor === undefined
            ? { model, relation, relationType, operation }
            : { model, relation, relationType, operation, neededFor },
      }
    }
    case 'M':
      return { errorIdentifier: 'MISSING_RECORD', context: { operation: context as string } }
    case 'i':
      return { errorIdentifier: 'INCOMPLETE_CONNECT_INPUT', context: { expectedRows: context as number } }
    case 'o': {
      const [expectedRows, relation, relationType] = context as readonly [number, string, string]
      return { errorIdentifier: 'INCOMPLETE_CONNECT_OUTPUT', context: { expectedRows, relation, relationType } }
    }
    case 'n': {
      const [relation, parent, child] = context as readonly [string, string, string]
      return { errorIdentifier: 'RECORDS_NOT_CONNECTED', context: { relation, parent, child } }
    }
  }
}

export type FieldArity = Arity | 'required' | 'optional'

export type FieldType = FieldScalarTypeName | ({ arity?: FieldArity } & FieldScalarType)

export type FieldScalarTypeName = CanonicalFieldScalarTypeName | CompactFieldScalarTypeName

export type CanonicalFieldScalarTypeName =
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

export type CompactFieldScalarTypeName = 's' | 'i' | 'I' | 'f' | 'b' | 'j' | 'o' | 'D' | 'd' | 'x'

export type FieldScalarType =
  | {
      type: FieldScalarTypeName
    }
  | { type: 'enum'; name: string }
  | { type: 'bytes'; encoding: 'array' | 'base64' | 'hex' }
