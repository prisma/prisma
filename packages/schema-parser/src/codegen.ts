/**
 * TypeScript code generation from Prisma Schema AST
 */

import type { CodeGenOptions, EnumAST, FieldAST, FieldType, ModelAST, SchemaAST } from './types.js'

type ModelLike = Pick<ModelAST, 'name' | 'fields'>

export interface GeneratedCode {
  typescript: string
  interfaces: string
  types: string
}

export class CodeGenerator {
  private options: CodeGenOptions

  constructor(options: CodeGenOptions = { target: 'typescript' }) {
    this.options = options
  }

  generateCode(ast: SchemaAST): GeneratedCode {
    const interfaces = this.generateInterfaces(ast)
    const types = this.generateTypes(ast)
    const typescript = this.combineCode(interfaces, types)

    return {
      typescript,
      interfaces,
      types,
    }
  }

  private generateInterfaces(ast: SchemaAST): string {
    const lines: string[] = []

    if (this.options.includeComments) {
      lines.push('// Generated interfaces from Prisma Schema')
      lines.push('')
    }

    // Generate model interfaces
    for (const model of ast.models) {
      lines.push(...this.generateModelInterface(model))
      lines.push('')
    }

    // Generate composite type interfaces
    for (const typeDef of ast.types) {
      lines.push(...this.generateModelInterface(typeDef))
      lines.push('')
    }

    // Generate view interfaces
    for (const viewDef of ast.views) {
      lines.push(...this.generateModelInterface(viewDef))
      lines.push('')
    }

    return lines.join('\n')
  }

  private generateTypes(ast: SchemaAST): string {
    const lines: string[] = []

    if (this.options.includeComments) {
      lines.push('// Generated types from Prisma Schema')
      lines.push('')
    }

    // Generate enum types
    for (const enumDef of ast.enums) {
      lines.push(...this.generateEnumType(enumDef))
      lines.push('')
    }

    return lines.join('\n')
  }

  private generateModelInterface(model: ModelLike): string[] {
    const lines: string[] = []

    if (this.options.includeComments) {
      lines.push(`// ${model.name} model`)
    }

    lines.push(`export interface ${model.name} {`)

    for (const field of model.fields) {
      const fieldLine = this.generateFieldProperty(field)
      lines.push(`  ${fieldLine}`)
    }

    lines.push('}')

    return lines
  }

  private generateFieldProperty(field: FieldAST): string {
    const tsType = this.mapFieldTypeToTypeScript(field.fieldType)
    const optional = field.isOptional ? '?' : ''
    const listSuffix = field.isList ? '[]' : ''

    return `${field.name}${optional}: ${tsType}${listSuffix}`
  }

  private generateEnumType(enumDef: EnumAST): string[] {
    const lines: string[] = []

    if (this.options.includeComments) {
      lines.push(`// ${enumDef.name} enum`)
    }

    lines.push(`export enum ${enumDef.name} {`)

    for (let i = 0; i < enumDef.values.length; i++) {
      const value = enumDef.values[i]
      const comma = i < enumDef.values.length - 1 ? ',' : ''
      lines.push(`  ${value.name} = '${value.name}'${comma}`)
    }

    lines.push('}')

    return lines
  }

  private mapFieldTypeToTypeScript(fieldType: FieldType): string {
    const typeMap: Record<string, string> = {
      String: 'string',
      Int: 'number',
      Float: 'number',
      Boolean: 'boolean',
      DateTime: 'Date',
      Json: 'any',
      Bytes: 'Buffer',
      BigInt: 'bigint',
      Decimal: 'number',
    }

    return typeMap[fieldType] || fieldType // Custom types use their name as-is
  }

  private combineCode(interfaces: string, types: string): string {
    const sections: string[] = []

    if (types.trim()) {
      sections.push(types)
    }

    if (interfaces.trim()) {
      sections.push(interfaces)
    }

    return sections.join('\n\n')
  }
}
