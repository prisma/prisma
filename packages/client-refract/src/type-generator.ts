/**
 * Type definition generator that consumes schema AST and generates Kysely-compatible TypeScript types
 */

import type { AttributeAST, FieldAST, ModelAST, SchemaAST } from '@refract/schema-parser'

import {
  type DatabaseSchema,
  type GeneratedField,
  type GeneratedModel,
  PRISMA_TO_KYSELY_TYPES,
  PRISMA_TO_TS_TYPES,
} from './types.js'

/**
 * Generates TypeScript type definitions from a parsed schema AST
 */
export class TypeGenerator {
  constructor(private schema: SchemaAST) {}

  /**
   * Generate Kysely-compatible database schema types
   */
  generateDatabaseSchema(): string {
    const models = this.schema.models
    const interfaces: string[] = []

    // Generate interface for each model/table
    for (const model of models) {
      const tableName = this.getTableName(model)
      const fields = this.generateModelFields(model)

      interfaces.push(`  ${tableName}: {`)
      for (const field of fields) {
        const optionalMarker = field.isOptional ? '?' : ''
        const listMarker = field.isList ? '[]' : ''
        interfaces.push(`    ${field.name}${optionalMarker}: ${field.type}${listMarker}`)
      }
      interfaces.push('  }')
    }

    return `export interface DatabaseSchema {
${interfaces.join('\n')}
}`
  }

  /**
   * Generate concrete database schema interface for runtime type safety
   */
  generateConcreteSchema(): Record<string, any> {
    const schema: Record<string, any> = {}

    for (const model of this.schema.models) {
      const tableName = this.getTableName(model)
      const fields = this.generateModelFields(model)

      const modelType: Record<string, any> = {}
      for (const field of fields) {
        // Create concrete type definitions that TypeScript can work with
        switch (field.type) {
          case 'string':
            modelType[field.name] = '' as string
            break
          case 'number':
            modelType[field.name] = 0 as number
            break
          case 'boolean':
            modelType[field.name] = false as boolean
            break
          case 'Date':
            modelType[field.name] = new Date() as Date
            break
          default:
            modelType[field.name] = null as any
        }
      }

      schema[tableName] = modelType
    }

    return schema
  }

  /**
   * Generate TypeScript model interfaces
   */
  generateModelInterfaces(): string {
    const models = this.schema.models
    const interfaces: string[] = []

    for (const model of models) {
      const fields = this.generateModelFields(model)

      interfaces.push(`export interface ${model.name} {`)
      for (const field of fields) {
        const optionalMarker = field.isOptional ? '?' : ''
        const listMarker = field.isList ? '[]' : ''
        interfaces.push(`  ${field.name}${optionalMarker}: ${field.type}${listMarker}`)
      }
      interfaces.push('}')
      interfaces.push('')
    }

    return interfaces.join('\n')
  }

  /**
   * Generate model operations types
   */
  generateModelOperationsTypes(): string {
    const models = this.schema.models
    const types: string[] = []

    for (const model of models) {
      const modelName = model.name
      const primaryKeyField = this.getPrimaryKeyField(model)
      const createType = this.generateCreateType(model)
      const updateType = this.generateUpdateType(model)
      const whereType = this.generateWhereType(model)

      types.push(`export interface ${modelName}Operations {`)
      types.push(`  findMany(args?: { where?: Partial<${modelName}> }): Promise<${modelName}[]>`)
      types.push(`  findUnique(where: ${whereType}): Promise<${modelName} | null>`)
      types.push(`  create(data: ${createType}): Promise<${modelName}>`)
      types.push(`  update(where: ${whereType}, data: ${updateType}): Promise<${modelName}>`)
      types.push(`  delete(where: ${whereType}): Promise<${modelName}>`)
      types.push('}')
      types.push('')
    }

    return types.join('\n')
  }

  /**
   * Generate fields for a model
   */
  generateModelFields(model: ModelAST): GeneratedField[] {
    return model.fields.map((field) => {
      const isPrimaryKey = this.hasAttribute(field, 'id')
      const isUnique = this.hasAttribute(field, 'unique') || isPrimaryKey
      const hasDefault = this.hasAttribute(field, 'default') || this.hasAttribute(field, 'updatedAt')

      return {
        name: field.name,
        type: this.mapFieldType(field),
        isOptional: field.isOptional,
        isList: field.isList,
        isPrimaryKey,
        isUnique,
        hasDefault,
      }
    })
  }

  /**
   * Map Prisma field type to TypeScript type
   */
  private mapFieldType(field: FieldAST): string {
    const baseType = field.fieldType

    // Handle built-in scalar types
    if (PRISMA_TO_TS_TYPES[baseType]) {
      return PRISMA_TO_TS_TYPES[baseType]
    }

    // Handle relation fields (references to other models)
    const relatedModel = this.schema.models.find((m) => m.name === baseType)
    if (relatedModel) {
      return baseType // Use the model name as the type
    }

    // Handle enum types
    const enumType = this.schema.enums.find((e) => e.name === baseType)
    if (enumType) {
      return baseType // Use the enum name as the type
    }

    // Fallback to string for unknown types
    return 'string'
  }

  /**
   * Get table name for a model (defaults to the Prisma model name)
   */
  private getTableName(model: ModelAST): string {
    // Check for @@map attribute
    const mapAttribute = model.attributes.find((attr) => attr.name === 'map')
    if (mapAttribute && mapAttribute.args[0]) {
      return String(mapAttribute.args[0].value)
    }

    // Default to Prisma's table naming convention (model name as-is)
    return model.name
  }

  /**
   * Check if a field has a specific attribute
   */
  private hasAttribute(field: FieldAST, attributeName: string): boolean {
    return field.attributes.some((attr) => attr.name === attributeName)
  }

  /**
   * Get the primary key field for a model
   */
  private getPrimaryKeyField(model: ModelAST): GeneratedField | null {
    const fields = this.generateModelFields(model)
    return fields.find((field) => field.isPrimaryKey) || null
  }

  /**
   * Generate create type (omits auto-generated fields)
   */
  private generateCreateType(model: ModelAST): string {
    const fields = this.generateModelFields(model)
    const requiredFields = fields.filter((field) => !field.isPrimaryKey && !field.hasDefault && !field.isOptional)
    const optionalFields = fields.filter((field) => !field.isPrimaryKey && (field.hasDefault || field.isOptional))

    if (requiredFields.length === 0 && optionalFields.length === 0) {
      return '{}'
    }

    const requiredPart =
      requiredFields.length > 0
        ? requiredFields.map((f) => `${f.name}: ${f.type}${f.isList ? '[]' : ''}`).join('; ')
        : ''

    const optionalPart =
      optionalFields.length > 0
        ? optionalFields.map((f) => `${f.name}?: ${f.type}${f.isList ? '[]' : ''}`).join('; ')
        : ''

    const parts = [requiredPart, optionalPart].filter(Boolean)
    return `{ ${parts.join('; ')} }`
  }

  /**
   * Generate update type (all fields optional except relations)
   */
  private generateUpdateType(model: ModelAST): string {
    const fields = this.generateModelFields(model)
    const updateableFields = fields.filter((field) => !field.isPrimaryKey)

    if (updateableFields.length === 0) {
      return '{}'
    }

    const fieldTypes = updateableFields.map((field) => `${field.name}?: ${field.type}${field.isList ? '[]' : ''}`)

    return `{ ${fieldTypes.join('; ')} }`
  }

  /**
   * Generate where type (typically uses unique fields)
   */
  private generateWhereType(model: ModelAST): string {
    const fields = this.generateModelFields(model)
    const uniqueFields = fields.filter((field) => field.isUnique)

    if (uniqueFields.length === 0) {
      // Fallback to all fields being optional
      const fieldTypes = fields.map((field) => `${field.name}?: ${field.type}${field.isList ? '[]' : ''}`)
      return `{ ${fieldTypes.join('; ')} }`
    }

    const fieldTypes = uniqueFields.map((field) => `${field.name}?: ${field.type}${field.isList ? '[]' : ''}`)

    return `{ ${fieldTypes.join('; ')} }`
  }

  /**
   * Get all generated models
   */
  getGeneratedModels(): GeneratedModel[] {
    return this.schema.models.map((model) => ({
      name: model.name,
      tableName: this.getTableName(model),
      fields: this.generateModelFields(model),
      operations: '', // Will be filled by operation generator
    }))
  }

  /**
   * Generate runtime model type information for better type inference
   */
  generateModelTypeInfo(modelName: string): { [key: string]: string } | null {
    const model = this.schema.models.find((m) => m.name === modelName)
    if (!model) return null

    const fields = this.generateModelFields(model)
    const typeInfo: { [key: string]: string } = {}

    for (const field of fields) {
      typeInfo[field.name] = field.type + (field.isList ? '[]' : '') + (field.isOptional ? ' | null' : '')
    }

    return typeInfo
  }

  /**
   * Generate a type-safe model interface constructor function
   * This creates a runtime type that TypeScript can use for inference
   */
  generateModelTypeConstructor(model: ModelAST): () => any {
    const fields = this.generateModelFields(model)
    const typeDefinition: { [key: string]: any } = {}

    for (const field of fields) {
      // Create type hints that TypeScript can infer from
      switch (field.type) {
        case 'string':
          typeDefinition[field.name] = field.isOptional ? (null as string | null) : ('' as string)
          break
        case 'number':
          typeDefinition[field.name] = field.isOptional ? (null as number | null) : (0 as number)
          break
        case 'boolean':
          typeDefinition[field.name] = field.isOptional ? (null as boolean | null) : (false as boolean)
          break
        case 'Date':
          typeDefinition[field.name] = field.isOptional ? (null as Date | null) : (new Date() as Date)
          break
        default:
          typeDefinition[field.name] = field.isOptional ? null : undefined
      }
    }

    return () => typeDefinition
  }

  /**
   * Generate a complete model interface as TypeScript code
   */
  generateModelInterface(model: ModelAST): string {
    const fields = this.generateModelFields(model)
    const fieldDeclarations = fields
      .map((field) => {
        const optionalMarker = field.isOptional ? '?' : ''
        const listMarker = field.isList ? '[]' : ''
        return `  ${field.name}${optionalMarker}: ${field.type}${listMarker}`
      })
      .join('\n')

    return `export interface ${model.name} {\n${fieldDeclarations}\n}`
  }

  /**
   * Generate concrete model type for use with Kysely
   */
  generateConcreteModelType(model: ModelAST): any {
    const fields = this.generateModelFields(model)
    const modelType: any = {}

    for (const field of fields) {
      if (field.isOptional) {
        modelType[field.name] = field.type
      } else {
        modelType[field.name] = field.type
      }
    }

    return modelType
  }
}
