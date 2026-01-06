/**
 * Core types for Refract client generation and operations
 */

import type { SchemaAST } from '@refract/schema-parser'
import type { Kysely } from 'kysely'

/**
 * Configuration for the Refract client
 */
export interface RefractClientConfig {
  datasourceUrl: string
  provider: 'postgresql' | 'postgres' | 'mysql' | 'sqlite'
  enableLogging?: boolean
  maxConnections?: number
}

/**
 * Prisma-compatible datasource configuration
 */
export interface RefractDatasourceConfig {
  /** Database connection string */
  connectionString: string
  /** Prisma-compatible provider name */
  provider: 'postgresql' | 'postgres' | 'mysql' | 'sqlite'
  /** SSL configuration */
  ssl?:
    | boolean
    | {
        rejectUnauthorized?: boolean
        ca?: string
        cert?: string
        key?: string
      }
  /** Connection pool size */
  poolSize?: number
  /** Connection timeout in milliseconds */
  connectionTimeout?: number
  /** Idle timeout in milliseconds */
  idleTimeout?: number
  /** Maximum connection lifetime in milliseconds */
  maxLifetime?: number
}

/**
 * Map Prisma-style provider names to internal driver provider names
 */
export const PRISMA_PROVIDER_TO_DRIVER_PROVIDER: Record<string, string> = {
  postgresql: 'pg',
  postgres: 'pg',
  mysql: 'mysql',
  sqlite: 'sqlite',
}

/**
 * Utility function to translate Prisma-style datasource config to driver config
 */
export function translateDatasourceConfig(config: RefractDatasourceConfig): any {
  const driverProvider = PRISMA_PROVIDER_TO_DRIVER_PROVIDER[config.provider]
  if (!driverProvider) {
    throw new Error(`Unsupported provider: ${config.provider}.`)
  }

  return {
    connectionString: config.connectionString,
    provider: driverProvider,
    ssl: config.ssl,
    poolSize: config.poolSize,
    connectionTimeout: config.connectionTimeout,
    idleTimeout: config.idleTimeout,
    maxLifetime: config.maxLifetime,
  }
}

/**
 * Database interface that represents the entire schema as Kysely-compatible types
 * Note: In Refract, this should represent your Prisma models, not table names
 * Example:
 * interface MySchema extends DatabaseSchema {
 *   User: { id: number, email: string }     // model User
 *   PostTag: { id: number, postId: number } // model PostTag
 * }
 */
export interface DatabaseSchema {
  [modelName: string]: Record<string, any>
}

/**
 * Type-safe CRUD operations interface for each model
 */
export interface ModelOperations<T> {
  findMany(args?: {
    where?: Partial<T> & Record<string, any>
    orderBy?: Record<keyof T, 'asc' | 'desc'>
    take?: number
    skip?: number
  }): Promise<T[]>

  findUnique(args: { where: Partial<T> & Record<string, any> }): Promise<T | null>

  findFirst(args?: {
    where?: Partial<T> & Record<string, any>
    orderBy?: Record<keyof T, 'asc' | 'desc'>
  }): Promise<T | null>

  create(args: { data: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & Record<string, any> }): Promise<T>

  createMany(args: {
    data: Array<Omit<T, 'id' | 'createdAt' | 'updatedAt'> & Record<string, any>>
    skipDuplicates?: boolean
  }): Promise<{ count: number }>

  update(args: {
    where: Partial<T> & Record<string, any>
    data: Partial<Omit<T, 'id' | 'createdAt'>> & Record<string, any>
  }): Promise<T>

  updateMany(args: {
    where?: Partial<T> & Record<string, any>
    data: Partial<Omit<T, 'id' | 'createdAt'>> & Record<string, any>
  }): Promise<{ count: number }>

  upsert(args: {
    where: Partial<T> & Record<string, any>
    create: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & Record<string, any>
    update: Partial<Omit<T, 'id' | 'createdAt'>> & Record<string, any>
  }): Promise<T>

  delete(args: { where: Partial<T> & Record<string, any> }): Promise<T>

  deleteMany(args?: { where?: Partial<T> & Record<string, any> }): Promise<{ count: number }>

  count(args?: { where?: Partial<T> & Record<string, any> }): Promise<number>
}

/**
 * Convert model name to client property name (just lowercase first letter)
 * Examples: "User" -> "user", "PostTag" -> "postTag", "Widgets" -> "widgets"
 */
export type ModelToProperty<S extends string> = S extends `${infer First}${infer Rest}`
  ? `${Lowercase<First>}${Rest}`
  : S

/**
 * Generate client model operations from Prisma model schema
 * Maps model names to client property names:
 * - User model -> client.user
 * - PostTag model -> client.postTag
 * - Widgets model -> client.widgets
 */
export type SchemaModels<TSchema extends DatabaseSchema> = {
  [K in keyof TSchema as K extends string ? ModelToProperty<K> : never]: K extends keyof TSchema
    ? ModelOperations<TSchema[K]>
    : never
}

/**
 * Base Refract client interface (implementable by classes)
 */
export interface RefractClient<TSchema extends DatabaseSchema = DatabaseSchema> {
  readonly $kysely: Kysely<TSchema>
}

/**
 * Enhanced RefractClient type with proper model typing for external usage
 * This provides the full TypeScript intellisense while allowing class implementation
 */
export type EnhancedRefractClientType<TSchema extends DatabaseSchema> = RefractClient<TSchema> &
  SchemaModels<TSchema> & {
    /** Connect to the database */
    $connect(): Promise<void>

    /** Disconnect from the database */
    $disconnect(): Promise<void>

    /** Execute operations within a transaction */
    $transaction<T>(fn: (client: EnhancedRefractClientType<TSchema>) => Promise<T>): Promise<T>

    /** Get client metadata and statistics */
    $info(): Promise<{
      connected: boolean
      provider: string
      modelsCount: number
      activeConnections?: number
      version: string
    }>

    /** Execute raw SQL queries */
    $queryRaw<T = unknown>(query: string, values?: unknown[]): Promise<T[]>

    /** Execute raw SQL commands */
    $executeRaw(query: string, values?: unknown[]): Promise<number>

    /** Cleanup resources */
    destroy(): Promise<void>
  }

/**
 * Generate model type from schema AST field information
 */
export type GeneratedModelType<TFields extends GeneratedField[]> = {
  [K in TFields[number] as K['name']]: K['type'] extends 'string'
    ? string
    : K['type'] extends 'number'
    ? number
    : K['type'] extends 'boolean'
    ? boolean
    : K['type'] extends 'Date'
    ? Date
    : any
} & Record<string, any>

/**
 * Type mapping from Prisma schema types to TypeScript types
 */
export const PRISMA_TO_TS_TYPES: Record<string, string> = {
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

/**
 * Type mapping from Prisma schema types to Kysely column types
 */
export const PRISMA_TO_KYSELY_TYPES: Record<string, string> = {
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

/**
 * Configuration for code generation
 */
export interface GeneratorConfig {
  schema: SchemaAST
  outputPath: string
  clientConfig: RefractClientConfig
}

/**
 * Generated model interface
 */
export interface GeneratedModel {
  name: string
  tableName: string
  fields: GeneratedField[]
  operations: string // Generated TypeScript code for operations
}

/**
 * Generated field interface
 */
export interface GeneratedField {
  name: string
  type: string
  isOptional: boolean
  isList: boolean
  isPrimaryKey: boolean
  isUnique: boolean
  hasDefault: boolean
}
