/**
 * @refract/client
 *
 * Type precedence:
 * Manual types > Generated types > Any types
 *
 * Architecture: Accept explicit Kysely dialects directly
 */

// Main client (class-based approach)
export type { RefractClientOptions } from './client.js'
export { RefractClient } from './client.js'

// Core types
export type {
  DatabaseSchema,
  GeneratedField,
  GeneratedModel,
  GeneratorConfig,
  ModelOperations,
  PRISMA_TO_KYSELY_TYPES,
  PRISMA_TO_TS_TYPES,
  RefractClientConfig,
  RefractDatasourceConfig,
} from './types.js'
export { PRISMA_PROVIDER_TO_DRIVER_PROVIDER, translateDatasourceConfig } from './types.js'

// Generator classes (for CLI generation)
export { TypeGenerator } from './type-generator.js'
export { EnhancedClientGeneratorWithTranslations } from './enhanced-client-generator.js'

// Schema parser types
export type {
  AttributeAST,
  DataSourceAST,
  EnumAST,
  FieldAST,
  GeneratorAST,
  ModelAST,
  ParseResult,
  SchemaAST,
} from '@refract/schema-parser'

// Kysely types (users control dialect dependencies directly)
export type {
  DeleteQueryBuilder,
  Dialect,
  InsertQueryBuilder,
  Kysely,
  SelectQueryBuilder,
  Transaction,
  UpdateQueryBuilder,
} from 'kysely'

// Convenience factory using shared config
export { createRefractClientFromConfig } from './client-factory.js'

// Default export for convenient importing
export { RefractClient as default } from './client.js'
