/**
 * @refract/client
 *
 * Type precedence:
 * Manual types > Generated types > Any types
 *
 */

export type { ModelFactory, RefractClientOptions } from './client'
export { RefractClientBase } from './client'
export { RefractClientBase as RefractClient } from './client'

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
} from './types'
export { PRISMA_PROVIDER_TO_DRIVER_PROVIDER, translateDatasourceConfig } from './types'

// Generator classes (for CLI generation)
export { ClientGenerator } from './client-generator'

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
export { createRefractClientFromConfig } from './client-factory'
