/**
 * @ork-orm/field-translator - Build-time database-specific field transformation code generators
 *
 * This package provides build-time code generators that produce database-specific
 * transformation code with ZERO runtime overhead. All translators are build-time
 * only tools that generate inline transformation code.
 *
 * Key Features:
 * - Zero runtime dependencies or overhead
 * - Database-specific type transformations (SQLite, PostgreSQL, MySQL)
 * - Build-time code generation with inline expressions
 * - Automatic dialect detection from configuration
 * - Comprehensive field analysis and metadata generation
 */

// Core types and interfaces
// Auto-register all built-in generators
import { FieldAnalyzer } from './field-analyzer.js'
import { generators } from './generators/index.js'
import { transformationRegistry } from './registry.js'
import type { DatabaseDialect } from './types.js'

export type {
  DatabaseDialect,
  FieldAnalysisResult,
  FieldTransformationGenerator,
  FieldTransformContext,
  GeneratedTransformation,
  ModelTransformationMetadata,
  SpecialFieldHandling,
  TransformationGeneratorRegistry,
  TransformationOperation,
  TransformationPerformance,
} from './types.js'

// Error types
export { TransformationGenerationError, UnsupportedDialectError, UnsupportedFieldTypeError } from './types.js'

// Core registry implementation
export { DefaultTransformationGeneratorRegistry, transformationRegistry } from './registry.js'

// Database-specific generators
export {
  generators,
  mysqlGenerator,
  MySQLTransformationGenerator,
  postgresqlGenerator,
  PostgreSQLTransformationGenerator,
  sqliteGenerator,
  SQLiteTransformationGenerator,
} from './generators/index.js'

// Dialect detection utilities
export type { KyselyDialectInfo, OrkConfig } from './dialect-detector.js'
export { detectDialect, DialectDetector } from './dialect-detector.js'

// Field analysis and metadata
export { FieldAnalyzer, ModelTransformationRegistry } from './field-analyzer.js'

// Register all generators on import
Object.values(generators).forEach((generator) => {
  transformationRegistry.register(generator)
})

// Convenient factory function for setting up the system
export function createFieldTranslator(dialect: DatabaseDialect) {
  const generator = transformationRegistry.getGenerator(dialect)
  if (!generator) {
    throw new Error(`No transformation generator found for dialect: ${dialect}`)
  }

  return new FieldAnalyzer(generator, dialect)
}

// Version and metadata
export const VERSION = '0.1.0'
export const DESCRIPTION = 'Build-time database-specific field transformation code generators for Ork ORM'
