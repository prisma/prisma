/**
 * Core types for Prisma Schema Language AST and processing
 */

export interface Position {
  line: number
  column: number
  offset: number
}

export interface Span {
  start: Position
  end: Position
}

export interface ASTNode {
  type: string
  span: Span
}

export interface SchemaAST extends ASTNode {
  type: 'Schema'
  datasources: DataSourceAST[]
  generators: GeneratorAST[]
  models: ModelAST[]
  enums: EnumAST[]
}

export interface DataSourceAST extends ASTNode {
  type: 'DataSource'
  name: string
  provider: string
  url: string
}

export interface GeneratorAST extends ASTNode {
  type: 'Generator'
  name: string
  provider: string
  output?: string
}

export interface ModelAST extends ASTNode {
  type: 'Model'
  name: string
  fields: FieldAST[]
  attributes: AttributeAST[]
}

export interface FieldAST extends ASTNode {
  type: 'Field'
  name: string
  fieldType: FieldType
  isOptional: boolean
  isList: boolean
  attributes: AttributeAST[]
}

export interface EnumAST extends ASTNode {
  type: 'Enum'
  name: string
  values: EnumValueAST[]
}

export interface EnumValueAST extends ASTNode {
  type: 'EnumValue'
  name: string
  attributes: AttributeAST[]
}

export interface AttributeAST extends ASTNode {
  type: 'Attribute'
  name: string
  args: AttributeArgumentAST[]
}

export interface AttributeArgumentAST extends ASTNode {
  type: 'AttributeArgument'
  name?: string
  value: string | number | boolean | string[] // Support array values for @relation
}

export type FieldType =
  | 'String'
  | 'Int'
  | 'Float'
  | 'Boolean'
  | 'DateTime'
  | 'Json'
  | 'Bytes'
  | 'BigInt'
  | 'Decimal'
  | string // Custom types/models

export interface CodeGenOptions {
  target: 'typescript'
  outputPath?: string
  includeComments?: boolean
}

export interface ParseResult {
  ast: SchemaAST
  errors: ParseError[]
}

export interface ParseError {
  message: string
  span: Span
  severity: 'error' | 'warning'
}
