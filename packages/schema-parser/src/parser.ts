/**
 * Chevrotain-based Prisma Schema Language Parser
 */

import { CstElement, CstNode, CstParser, ICstVisitor, IToken } from 'chevrotain'

import {
  allTokens,
  At,
  AtAt,
  Colon,
  Comma,
  DataSource,
  Enum,
  Equals,
  Generator,
  Identifier,
  LBrace,
  LBracket,
  LParen,
  Model,
  NumberLiteral,
  Question,
  RBrace,
  RBracket,
  RParen,
  StringLiteral,
  tokenizeSchema,
} from './lexer.js'
import type {
  AttributeArgumentAST,
  AttributeAST,
  DataSourceAST,
  EnumAST,
  EnumValueAST,
  FieldAST,
  FieldType,
  GeneratorAST,
  ModelAST,
  ParseResult,
  SchemaAST,
} from './types.js'

export class Parser extends CstParser {
  constructor() {
    super(allTokens, {
      recoveryEnabled: true,
      nodeLocationTracking: 'full',
    })

    this.performSelfAnalysis()
  }

  // Root rule
  schema = this.RULE('schema', () => {
    this.MANY(() => {
      this.OR([
        { ALT: () => this.SUBRULE(this.dataSource) },
        { ALT: () => this.SUBRULE(this.generator) },
        { ALT: () => this.SUBRULE(this.model) },
        { ALT: () => this.SUBRULE(this.enumDeclaration) },
      ])
    })
  })

  // DataSource declaration
  dataSource = this.RULE('dataSource', () => {
    this.CONSUME(DataSource)
    this.CONSUME(Identifier, { LABEL: 'name' })
    this.CONSUME(LBrace)
    this.MANY(() => {
      this.SUBRULE(this.configProperty)
    })
    this.CONSUME(RBrace)
  })

  // Generator declaration
  generator = this.RULE('generator', () => {
    this.CONSUME(Generator)
    this.CONSUME(Identifier, { LABEL: 'name' })
    this.CONSUME(LBrace)
    this.MANY(() => {
      this.SUBRULE(this.configProperty)
    })
    this.CONSUME(RBrace)
  })

  // Config property (used in datasource and generator)
  configProperty = this.RULE('configProperty', () => {
    this.CONSUME(Identifier, { LABEL: 'key' })
    this.CONSUME(Equals)
    this.OR([
      { ALT: () => this.CONSUME(StringLiteral, { LABEL: 'value' }) },
      { ALT: () => this.SUBRULE(this.functionCall) },
    ])
  })

  // Function call like env("DATABASE_URL") or cuid()
  functionCall = this.RULE('functionCall', () => {
    this.CONSUME(Identifier, { LABEL: 'functionName' })
    this.CONSUME(LParen)
    this.OPTION(() => {
      this.OR([
        { ALT: () => this.CONSUME(StringLiteral, { LABEL: 'argument' }) },
        { ALT: () => this.CONSUME(NumberLiteral, { LABEL: 'argument' }) },
        { ALT: () => this.CONSUME2(Identifier, { LABEL: 'argument' }) },
      ])
    })
    this.CONSUME(RParen)
  })

  // Model declaration
  model = this.RULE('model', () => {
    this.CONSUME(Model)
    this.CONSUME(Identifier, { LABEL: 'name' })
    this.CONSUME(LBrace)
    this.MANY(() => {
      this.OR([{ ALT: () => this.SUBRULE(this.field) }, { ALT: () => this.SUBRULE(this.modelAttribute) }])
    })
    this.CONSUME(RBrace)
  })

  // Field declaration
  field = this.RULE('field', () => {
    this.CONSUME(Identifier, { LABEL: 'name' })
    this.CONSUME2(Identifier, { LABEL: 'type' })

    // Optional field modifiers
    this.OPTION(() => {
      this.OR([
        { ALT: () => this.CONSUME(Question) }, // Optional field
        {
          ALT: () => {
            // Array field
            this.CONSUME(LBracket)
            this.CONSUME(RBracket)
          },
        },
      ])
    })

    // Field attributes
    this.MANY(() => {
      this.SUBRULE(this.fieldAttribute)
    })
  })

  // Field attribute (@id, @unique, etc.)
  fieldAttribute = this.RULE('fieldAttribute', () => {
    this.CONSUME(At)
    this.CONSUME(Identifier, { LABEL: 'name' })
    this.OPTION(() => {
      this.SUBRULE(this.attributeArguments)
    })
  })

  // Model attribute (@@id, @@unique, etc.)
  modelAttribute = this.RULE('modelAttribute', () => {
    this.CONSUME(AtAt)
    this.CONSUME(Identifier, { LABEL: 'name' })
    this.OPTION(() => {
      this.SUBRULE(this.attributeArguments)
    })
  })

  // Attribute arguments
  attributeArguments = this.RULE('attributeArguments', () => {
    this.CONSUME(LParen)
    this.MANY_SEP({
      SEP: Comma,
      DEF: () => {
        this.SUBRULE(this.attributeArgument)
      },
    })
    this.CONSUME(RParen)
  })

  // Single attribute argument
  attributeArgument = this.RULE('attributeArgument', () => {
    // Named argument (name: value) or positional argument
    this.OPTION(() => {
      this.CONSUME(Identifier, { LABEL: 'name' })
      this.CONSUME(Colon)
    })

    this.OR([
      { ALT: () => this.CONSUME(StringLiteral, { LABEL: 'value' }) },
      { ALT: () => this.CONSUME(NumberLiteral, { LABEL: 'value' }) },
      { ALT: () => this.SUBRULE(this.functionCall) }, // Support function calls like cuid()
      { ALT: () => this.CONSUME2(Identifier, { LABEL: 'value' }) },
      { ALT: () => this.SUBRULE(this.arrayValue) }, // Support array values like [userId]
    ])
  })

  // Array value for @relation attributes
  arrayValue = this.RULE('arrayValue', () => {
    this.CONSUME(LBracket)
    this.MANY_SEP({
      SEP: Comma,
      DEF: () => {
        this.CONSUME(Identifier, { LABEL: 'element' })
      },
    })
    this.CONSUME(RBracket)
  })

  // Enum declaration
  enumDeclaration = this.RULE('enumDeclaration', () => {
    this.CONSUME(Enum)
    this.CONSUME(Identifier, { LABEL: 'name' })
    this.CONSUME(LBrace)
    this.MANY(() => {
      this.SUBRULE(this.enumValue)
    })
    this.CONSUME(RBrace)
  })

  // Enum value
  enumValue = this.RULE('enumValue', () => {
    this.CONSUME(Identifier, { LABEL: 'name' })
    this.MANY(() => {
      this.SUBRULE(this.fieldAttribute) // Enum values can have attributes
    })
  })
}

// CST Visitor for converting CST to AST
export class SchemaVisitor implements ICstVisitor<any, any> {
  constructor(private parser: Parser) {}

  validateVisitor(): void {
    // Chevrotain visitor validation - implementation can be empty
  }

  schema(ctx: any): SchemaAST {
    const datasources: DataSourceAST[] = []
    const generators: GeneratorAST[] = []
    const models: ModelAST[] = []
    const enums: EnumAST[] = []

    if (ctx.dataSource) {
      datasources.push(...ctx.dataSource.map((ds: any) => this.visit(ds)))
    }
    if (ctx.generator) {
      generators.push(...ctx.generator.map((gen: any) => this.visit(gen)))
    }
    if (ctx.model) {
      models.push(...ctx.model.map((model: any) => this.visit(model)))
    }
    if (ctx.enumDeclaration) {
      enums.push(...ctx.enumDeclaration.map((enumDecl: any) => this.visit(enumDecl)))
    }

    return {
      type: 'Schema',
      span: this.getSpan(ctx),
      datasources,
      generators,
      models,
      enums,
    }
  }

  dataSource(ctx: any): DataSourceAST {
    const name = ctx.name[0].image
    const properties = ctx.configProperty?.map((prop: any) => this.visit(prop)) || []

    let provider = ''
    let url = ''

    for (const prop of properties) {
      if (prop.key === 'provider') {
        provider = prop.value
      } else if (prop.key === 'url') {
        url = prop.value
      }
    }

    return {
      type: 'DataSource',
      span: this.getSpan(ctx),
      name,
      provider,
      url,
    }
  }

  generator(ctx: any): GeneratorAST {
    const name = ctx.name[0].image
    const properties = ctx.configProperty?.map((prop: any) => this.visit(prop)) || []

    let provider = ''
    let output: string | undefined

    for (const prop of properties) {
      if (prop.key === 'provider') {
        provider = prop.value
      } else if (prop.key === 'output') {
        output = prop.value
      }
    }

    return {
      type: 'Generator',
      span: this.getSpan(ctx),
      name,
      provider,
      output,
    }
  }

  configProperty(ctx: any) {
    const key = ctx.key[0].image
    let value: string

    if (ctx.value) {
      // String literal value
      value = this.parseStringLiteral(ctx.value[0].image)
    } else if (ctx.functionCall) {
      // Function call like env("DATABASE_URL")
      value = this.visit(ctx.functionCall[0])
    } else {
      value = ''
    }

    return { key, value }
  }

  functionCall(ctx: any): string {
    const functionName = ctx.functionName[0].image
    if (ctx.argument && ctx.argument.length > 0) {
      const token = ctx.argument[0]
      if (token.tokenType.name === 'StringLiteral') {
        const argument = this.parseStringLiteral(token.image)
        return `${functionName}("${argument}")`
      } else {
        return `${functionName}(${token.image})`
      }
    } else {
      return `${functionName}()`
    }
  }

  model(ctx: any): ModelAST {
    const name = ctx.name[0].image
    const fields: FieldAST[] = ctx.field?.map((field: any) => this.visit(field)) || []
    const attributes: AttributeAST[] = ctx.modelAttribute?.map((attr: any) => this.visit(attr)) || []

    return {
      type: 'Model',
      span: this.getSpan(ctx),
      name,
      fields,
      attributes,
    }
  }

  field(ctx: any): FieldAST {
    const name = ctx.name[0].image
    const fieldType = ctx.type[0].image as FieldType
    const isOptional = !!ctx.Question
    const isList = !!ctx.LBracket
    const attributes: AttributeAST[] = ctx.fieldAttribute?.map((attr: any) => this.visit(attr)) || []

    return {
      type: 'Field',
      span: this.getSpan(ctx),
      name,
      fieldType,
      isOptional,
      isList,
      attributes,
    }
  }

  fieldAttribute(ctx: any): AttributeAST {
    return this.buildAttribute(ctx)
  }

  modelAttribute(ctx: any): AttributeAST {
    return this.buildAttribute(ctx)
  }

  private buildAttribute(ctx: any): AttributeAST {
    const name = ctx.name[0].image
    const args: AttributeArgumentAST[] = ctx.attributeArguments?.[0] ? this.visit(ctx.attributeArguments[0]) : []

    return {
      type: 'Attribute',
      span: this.getSpan(ctx),
      name,
      args,
    }
  }

  attributeArguments(ctx: any): AttributeArgumentAST[] {
    return ctx.attributeArgument?.map((arg: any) => this.visit(arg)) || []
  }

  attributeArgument(ctx: any): AttributeArgumentAST {
    const name = ctx.name?.[0]?.image
    let value: string | number | boolean | string[]

    if (ctx.arrayValue) {
      // Handle array values like [userId, id]
      value = this.visit(ctx.arrayValue[0])
    } else if (ctx.functionCall) {
      // Handle function calls like cuid(), now(), etc.
      value = this.visit(ctx.functionCall[0])
    } else if (ctx.value) {
      const token = ctx.value[0]
      if (token.tokenType.name === 'StringLiteral') {
        value = this.parseStringLiteral(token.image)
      } else if (token.tokenType.name === 'NumberLiteral') {
        value = Number(token.image)
      } else {
        // Boolean or identifier
        if (token.image === 'true') {
          value = true
        } else if (token.image === 'false') {
          value = false
        } else {
          value = token.image
        }
      }
    } else {
      value = ''
    }

    return {
      type: 'AttributeArgument',
      span: this.getSpan(ctx),
      name,
      value,
    }
  }

  arrayValue(ctx: any): string[] {
    return ctx.element?.map((elem: any) => elem.image) || []
  }

  enumDeclaration(ctx: any): EnumAST {
    const name = ctx.name[0].image
    const values: EnumValueAST[] = ctx.enumValue?.map((val: any) => this.visit(val)) || []

    return {
      type: 'Enum',
      span: this.getSpan(ctx),
      name,
      values,
    }
  }

  enumValue(ctx: any): EnumValueAST {
    const name = ctx.name[0].image
    const attributes: AttributeAST[] = ctx.fieldAttribute?.map((attr: any) => this.visit(attr)) || []

    return {
      type: 'EnumValue',
      span: this.getSpan(ctx),
      name,
      attributes,
    }
  }

  private parseStringLiteral(str: string): string {
    // Remove quotes and handle escape sequences
    return str.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }

  private getSpan(ctx: any) {
    // Simple span implementation - Chevrotain provides location info
    return {
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 1, offset: 0 },
    }
  }

  visit(cstNode: CstNode | CstNode[], param?: any): any {
    if (Array.isArray(cstNode)) {
      return cstNode.map((node) => this.visit(node))
    }

    if ('name' in cstNode) {
      const methodName = cstNode.name as keyof this
      const method = this[methodName] as any
      if (typeof method === 'function') {
        return method.call(this, cstNode.children)
      }
    }
    throw new Error(`No visit method for ${(cstNode as any).name}`)
  }
}

// Main parsing function
export function parseSchemaWithChevrotain(text: string): ParseResult {
  const lexResult = tokenizeSchema(text)

  if (lexResult.errors.length > 0) {
    return {
      ast: {
        type: 'Schema',
        span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
        datasources: [],
        generators: [],
        models: [],
        enums: [],
      },
      errors: lexResult.errors.map((err) => ({
        message: err.message,
        span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
        severity: 'error' as const,
      })),
    }
  }

  const parser = new Parser()
  const visitor = new SchemaVisitor(parser)

  parser.input = lexResult.tokens
  const cst = parser.schema()

  if (parser.errors.length > 0) {
    return {
      ast: {
        type: 'Schema',
        span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
        datasources: [],
        generators: [],
        models: [],
        enums: [],
      },
      errors: parser.errors.map((err) => ({
        message: err.message,
        span: { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } },
        severity: 'error' as const,
      })),
    }
  }

  const ast = visitor.visit(cst)

  return {
    ast,
    errors: [],
  }
}
