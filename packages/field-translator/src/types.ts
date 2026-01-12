/**
 * Core interfaces and types for build-time field transformation code generation
 * 
 * The FieldTranslator system generates inline transformation code at build time
 * with ZERO runtime overhead - no translator dependencies or runtime processing.
 */

import type { FieldAST } from '@ork/schema-parser'

/**
 * Supported database dialects for transformation code generation
 */
export type DatabaseDialect = 'postgresql' | 'mysql' | 'sqlite'

/**
 * Field transformation context for code generation
 */
export interface FieldTransformContext {
  field: FieldAST
  dialect: DatabaseDialect
  operation: TransformationOperation
  variableName: string
}

/**
 * Database operation context for transformations
 */
export type TransformationOperation = 
  | 'create'       // INSERT operations - input to database format
  | 'update'       // UPDATE operations - input to database format  
  | 'where'        // WHERE conditions - input to database format
  | 'select'       // SELECT results - database to JavaScript format

/**
 * Generated transformation code result
 */
export interface GeneratedTransformation {
  /** The generated TypeScript/JavaScript code (inline expression) */
  code: string
  /** Any required imports for the transformation */
  imports: string[]
  /** Whether this transformation requires error handling */
  needsErrorHandling: boolean
  /** Performance characteristics of this transformation */
  performance: TransformationPerformance
}

/**
 * Performance metadata for generated transformations
 */
export interface TransformationPerformance {
  /** Complexity level (simple, moderate, complex) */
  complexity: 'simple' | 'moderate' | 'complex'
  /** Whether transformation can be inlined completely */
  inlinable: boolean
  /** Estimated performance impact (negligible, low, medium, high) */
  impact: 'negligible' | 'low' | 'medium' | 'high'
}

/**
 * Core interface for dialect-specific transformation code generators
 * 
 * Each database dialect implements this interface to generate optimized
 * transformation code for their specific type system and requirements.
 */
export interface FieldTransformationGenerator {
  /** Database dialect this generator supports */
  readonly dialect: DatabaseDialect
  
  /** 
   * Generate transformation code for a specific field and operation
   * 
   * @param context - Field and operation context
   * @returns Generated inline transformation code
   */
  generateTransformation(context: FieldTransformContext): GeneratedTransformation
  
  /**
   * Check if this generator supports transforming the given field type
   * 
   * @param field - Field to check
   * @returns true if field type is supported
   */
  supportsField(field: FieldAST): boolean
  
  /**
   * Get the expected database column type for a schema field
   * 
   * @param field - Schema field
   * @returns Database-specific column type
   */
  getDatabaseColumnType(field: FieldAST): string
}

/**
 * Registry for managing multiple transformation generators
 */
export interface TransformationGeneratorRegistry {
  /** Register a transformation generator for a dialect */
  register(generator: FieldTransformationGenerator): void
  
  /** Get generator for a specific dialect */
  getGenerator(dialect: DatabaseDialect): FieldTransformationGenerator | undefined
  
  /** Get all registered dialects */
  getSupportedDialects(): DatabaseDialect[]
  
  /** Generate transformation for field in specified dialect */
  generateTransformation(dialect: DatabaseDialect, context: FieldTransformContext): GeneratedTransformation
}

/**
 * Build-time field metadata analysis result
 */
export interface FieldAnalysisResult {
  /** Original field definition */
  field: FieldAST
  /** Required transformations by operation type */
  transformations: Map<TransformationOperation, GeneratedTransformation>
  /** Database column type */
  columnType: string
  /** Any special handling requirements */
  specialHandling: SpecialFieldHandling[]
}

/**
 * Special handling requirements for fields
 */
export type SpecialFieldHandling = 
  | 'timestamp_auto'      // Auto-generated timestamps
  | 'primary_key'         // Primary key field
  | 'foreign_key'         // Foreign key relationship
  | 'unique_constraint'   // Unique constraint
  | 'nullable'            // Nullable field
  | 'default_value'       // Has default value
  | 'json_validation'     // JSON field requiring validation
  | 'enum_constraint'     // Enum type constraint

/**
 * Complete model transformation metadata
 */
export interface ModelTransformationMetadata {
  /** Model name */
  modelName: string
  /** Table name (may differ from model name) */
  tableName: string
  /** Field transformation metadata */
  fields: Map<string, FieldAnalysisResult>
  /** Database dialect */
  dialect: DatabaseDialect
  /** Generated at timestamp */
  generatedAt: Date
}

/**
 * Error types for transformation generation
 */
export class TransformationGenerationError extends Error {
  constructor(
    message: string,
    public readonly field: FieldAST,
    public readonly dialect: DatabaseDialect,
    public readonly operation: TransformationOperation
  ) {
    super(message)
    this.name = 'TransformationGenerationError'
  }
}

export class UnsupportedFieldTypeError extends TransformationGenerationError {
  constructor(field: FieldAST, dialect: DatabaseDialect) {
    super(
      `Field type '${field.fieldType}' is not supported for dialect '${dialect}'`,
      field,
      dialect,
      'create'
    )
    this.name = 'UnsupportedFieldTypeError'
  }
}

export class UnsupportedDialectError extends Error {
  constructor(dialect: string) {
    super(`Database dialect '${dialect}' is not supported`)
    this.name = 'UnsupportedDialectError'
  }
}
