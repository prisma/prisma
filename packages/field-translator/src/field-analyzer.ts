/**
 * Build-time field metadata analysis system
 *
 * Maps Prisma schema types to transformation code generators and maintains
 * generation state for optimal code output.
 */

import type { FieldAST, ModelAST } from '@ork-orm/schema-parser'

import type {
  DatabaseDialect,
  FieldAnalysisResult,
  FieldTransformationGenerator,
  FieldTransformContext,
  GeneratedTransformation,
  ModelTransformationMetadata,
  SpecialFieldHandling,
  TransformationOperation,
} from './types.js'

/**
 * Analyzes fields and generates transformation metadata
 */
export class FieldAnalyzer {
  constructor(private generator: FieldTransformationGenerator, private dialect: DatabaseDialect) {}

  /**
   * Analyze a single field and generate transformation metadata
   */
  analyzeField(field: FieldAST): FieldAnalysisResult {
    const transformations = new Map<TransformationOperation, GeneratedTransformation>()
    const operations: TransformationOperation[] = ['create', 'update', 'where', 'select']

    // Generate transformations for each operation
    for (const operation of operations) {
      const context: FieldTransformContext = {
        field,
        dialect: this.dialect,
        operation,
        variableName: `data.${field.name}`,
      }

      try {
        const transformation = this.generator.generateTransformation(context)
        transformations.set(operation, transformation)
      } catch (error) {
        // Log error but continue with other operations
        console.warn(`Failed to generate ${operation} transformation for field ${field.name}:`, error)
      }
    }

    return {
      field,
      transformations,
      columnType: this.generator.getDatabaseColumnType(field),
      specialHandling: this.detectSpecialHandling(field),
    }
  }

  /**
   * Analyze all fields in a model
   */
  analyzeModel(model: ModelAST): ModelTransformationMetadata {
    const fields = new Map<string, FieldAnalysisResult>()

    for (const field of model.fields) {
      try {
        const analysis = this.analyzeField(field)
        fields.set(field.name, analysis)
      } catch (error) {
        console.warn(`Failed to analyze field ${field.name} in model ${model.name}:`, error)
      }
    }

    return {
      modelName: model.name,
      tableName: this.getTableName(model),
      fields,
      dialect: this.dialect,
      generatedAt: new Date(),
    }
  }

  /**
   * Detect special handling requirements for a field
   */
  private detectSpecialHandling(field: FieldAST): SpecialFieldHandling[] {
    const handling: SpecialFieldHandling[] = []

    // Check field attributes
    for (const attr of field.attributes) {
      switch (attr.name) {
        case 'id':
          handling.push('primary_key')
          break
        case 'unique':
          handling.push('unique_constraint')
          break
        case 'default':
          handling.push('default_value')
          break
        case 'updatedAt':
          handling.push('timestamp_auto')
          break
        case 'relation':
          handling.push('foreign_key')
          break
      }
    }

    // Check field properties
    if (field.isOptional) {
      handling.push('nullable')
    }

    if (field.fieldType === 'Json') {
      handling.push('json_validation')
    }

    // Check for enum types (would need enum info from schema)
    // This would be enhanced with actual enum detection

    return handling
  }

  /**
   * Get table name for model (respecting @@map)
   */
  private getTableName(model: ModelAST): string {
    const mapAttribute = model.attributes.find((attr) => attr.name === 'map')
    if (mapAttribute && mapAttribute.args[0]) {
      return String(mapAttribute.args[0].value)
    }
    return model.name
  }
}

/**
 * Model transformation metadata registry
 */
export class ModelTransformationRegistry {
  private models = new Map<string, ModelTransformationMetadata>()

  /**
   * Register transformation metadata for a model
   */
  register(metadata: ModelTransformationMetadata): void {
    this.models.set(metadata.modelName, metadata)
  }

  /**
   * Get transformation metadata for a model
   */
  getModel(modelName: string): ModelTransformationMetadata | undefined {
    return this.models.get(modelName)
  }

  /**
   * Get all registered models
   */
  getAllModels(): ModelTransformationMetadata[] {
    return Array.from(this.models.values())
  }

  /**
   * Clear all registered models
   */
  clear(): void {
    this.models.clear()
  }

  /**
   * Get transformation for specific field and operation
   */
  getFieldTransformation(
    modelName: string,
    fieldName: string,
    operation: TransformationOperation,
  ): GeneratedTransformation | undefined {
    const model = this.getModel(modelName)
    if (!model) return undefined

    const field = model.fields.get(fieldName)
    if (!field) return undefined

    return field.transformations.get(operation)
  }

  /**
   * Check if field has special handling requirements
   */
  hasSpecialHandling(modelName: string, fieldName: string, handling: SpecialFieldHandling): boolean {
    const model = this.getModel(modelName)
    if (!model) return false

    const field = model.fields.get(fieldName)
    if (!field) return false

    return field.specialHandling.includes(handling)
  }

  /**
   * Get generation statistics
   */
  getStats() {
    const models = this.getAllModels()
    let totalFields = 0
    let totalTransformations = 0
    let errorCount = 0

    for (const model of models) {
      totalFields += model.fields.size

      for (const [, field] of model.fields) {
        totalTransformations += field.transformations.size

        // Count missing transformations as errors
        const expectedOps = 4 // create, update, where, select
        if (field.transformations.size < expectedOps) {
          errorCount += expectedOps - field.transformations.size
        }
      }
    }

    return {
      modelCount: models.length,
      fieldCount: totalFields,
      transformationCount: totalTransformations,
      errorCount,
      dialect: models[0]?.dialect || 'unknown',
    }
  }
}
