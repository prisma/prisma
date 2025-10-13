/**
 * Refract Client
 *
 * Recommended: Use unplugin-refract for automatic `.refract/types` virtual modules
 * Manual Fallback: Explicitly import and pass types when unplugin isn't available
 *
 * Architecture: Accept explicit Kysely dialect instances directly
 */

import { type FieldAST, type ModelAST, parseSchema, type SchemaAST } from '@refract/schema-parser'
import { type Dialect, type ExpressionBuilder, Kysely, type OnConflictBuilder } from 'kysely'

import type { DatabaseSchema } from './types.js'

/**
 * Generated schema interface for module augmentation by .refract/types.ts
 *
 * Two usage patterns:
 * 1. Recommended: unplugin-refract makes import('.refract/types') work automatically
 * 2. Manual Fallback: import types explicitly and pass to RefractClient<MyTypes>()
 */
interface RefractGeneratedSchema extends DatabaseSchema {}

// Auto-load generated types via recommended approach (unplugin virtual modules) or manual fallback
// @ts-ignore - Recommended approach: unplugin-refract creates virtual modules for this import
import('.refract/types').catch(() => {
  // Silent failure - generated types are optional
  // Recommended approach: unplugin-refract makes this import work seamlessly
  // Manual fallback: users import types explicitly and pass to client
  if (process.env.NODE_ENV === 'development') {
    console.debug('ℹ️ Refract: No generated types found - use unplugin-refract or import types manually')
  }
})

/**
 * Client configuration options
 */
export interface RefractClientOptions {
  /** Prisma schema content or file path for runtime model discovery */
  schema?: string
}

/**
 * CRUD operations interface for a model
 */
export interface ModelCRUDOperations {
  findMany(args?: { where?: any; select?: any; orderBy?: any; take?: number; skip?: number }): Promise<any[]>
  findUnique(args: { where: any; select?: any }): Promise<any | undefined>
  findFirst(args?: { where?: any; select?: any; orderBy?: any }): Promise<any | null>
  create(args: { data: any }): Promise<any>
  createMany(args: { data: any[] }): Promise<{ count: number }>
  update(args: { where: any; data: any }): Promise<any>
  updateMany(args: { where?: any; data: any }): Promise<{ count: number }>
  upsert(args: { where: any; create: any; update: any }): Promise<any>
  delete(args: { where: any }): Promise<any>
  deleteMany(args?: { where?: any }): Promise<{ count: number }>
  count(args?: { where?: any }): Promise<number>
}

/**
 * Model operations implementation with comprehensive CRUD functionality
 */
class ModelOperations implements ModelCRUDOperations {
  constructor(private kysely: Kysely<any>, private tableName: string, private model: ModelAST) {}

  /**
   * Apply where conditions to a query with comprehensive operator support
   */
  private applyWhereConditions(query: any, where: Record<string, unknown>): any {
    let currentQuery = query

    for (const [field, value] of Object.entries(where)) {
      const columnName = field // Use field name as-is (Prisma default)

      if (value === null) {
        currentQuery = (currentQuery as any).where(columnName, 'is', null)
      } else if (typeof value === 'object' && value !== null) {
        // Handle complex where conditions (gt, lt, contains, etc.)
        for (const [operator, operatorValue] of Object.entries(value)) {
          switch (operator) {
            case 'gt':
              currentQuery = (currentQuery as any).where(columnName, '>', operatorValue)
              break
            case 'gte':
              currentQuery = (currentQuery as any).where(columnName, '>=', operatorValue)
              break
            case 'lt':
              currentQuery = (currentQuery as any).where(columnName, '<', operatorValue)
              break
            case 'lte':
              currentQuery = (currentQuery as any).where(columnName, '<=', operatorValue)
              break
            case 'not':
              currentQuery = (currentQuery as any).where(columnName, '!=', operatorValue)
              break
            case 'in':
              currentQuery = (currentQuery as any).where(columnName, 'in', operatorValue as unknown[])
              break
            case 'notIn':
              currentQuery = (currentQuery as any).where(columnName, 'not in', operatorValue as unknown[])
              break
            case 'contains':
              currentQuery = (currentQuery as any).where(columnName, 'like', `%${operatorValue}%`)
              break
            case 'startsWith':
              currentQuery = (currentQuery as any).where(columnName, 'like', `${operatorValue}%`)
              break
            case 'endsWith':
              currentQuery = (currentQuery as any).where(columnName, 'like', `%${operatorValue}`)
              break
          }
        }
      } else {
        // Transform boolean values for SQLite compatibility
        const transformedValue = typeof value === 'boolean' ? (value ? 1 : 0) : value
        currentQuery = (currentQuery as any).where(columnName, '=', transformedValue)
      }
    }

    return currentQuery
  }

  /**
   * Transform values based on field type
   */
  private transformValue(field: FieldAST, value: unknown): unknown {
    if (value === null || value === undefined) {
      return null
    }

    switch (field.fieldType) {
      case 'DateTime':
        return value instanceof Date ? value.toISOString() : new Date(value as string).toISOString()
      case 'Json':
        return typeof value === 'string' ? value : JSON.stringify(value)
      case 'Int':
      case 'Float':
        return Number(value)
      case 'Boolean':
        return Boolean(value) ? 1 : 0 // SQLite stores booleans as integers
      case 'String':
      default:
        return String(value)
    }
  }

  /**
   * Prepare data for create operations
   */
  private prepareCreateData(data: Record<string, unknown>): Record<string, unknown> {
    const prepared: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(data)) {
      const field = this.model.fields.find((f) => f.name === key)
      if (field) {
        const columnName = field.name // Use field name as-is (Prisma default)
        prepared[columnName] = this.transformValue(field, value)
      }
    }

    // Add timestamps if they exist in the model
    const hasCreatedAt = this.model.fields.some((f) => f.name === 'createdAt')
    const hasUpdatedAt = this.model.fields.some((f) => f.name === 'updatedAt')

    if (hasCreatedAt) {
      prepared.createdAt = new Date().toISOString() // SQLite needs string format
    }

    if (hasUpdatedAt) {
      prepared.updatedAt = new Date().toISOString() // SQLite needs string format
    }

    return prepared
  }

  /**
   * Prepare data for update operations
   */
  private prepareUpdateData(data: Record<string, unknown>): Record<string, unknown> {
    const prepared: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(data)) {
      const field = this.model.fields.find((f) => f.name === key)
      if (field && field.name !== 'id' && field.name !== 'createdAt') {
        const columnName = field.name // Use field name as-is (Prisma default)
        prepared[columnName] = this.transformValue(field, value)
      }
    }

    // Add updatedAt timestamp if it exists
    const hasUpdatedAt = this.model.fields.some((f) => f.name === 'updatedAt')
    if (hasUpdatedAt) {
      prepared.updatedAt = new Date().toISOString() // SQLite needs string format
    }

    return prepared
  }

  /**
   * Find the unique field in a model (for upsert operations)
   */
  private findUniqueField(): FieldAST | null {
    return (
      this.model.fields.find((f) => f.attributes.some((attr) => attr.name === 'id' || attr.name === 'unique')) || null
    )
  }

  async findMany(args?: {
    where?: Record<string, any>
    select?: string[]
    orderBy?: Record<string, 'asc' | 'desc'>
    take?: number
    skip?: number
  }): Promise<any[]> {
    let query = this.kysely.selectFrom(this.tableName).selectAll()

    if (args?.where) {
      query = this.applyWhereConditions(query, args.where)
    }

    if (args?.orderBy) {
      for (const [field, direction] of Object.entries(args.orderBy)) {
        query = query.orderBy(field as any, direction)
      }
    }

    if (args?.skip) {
      query = query.offset(args.skip)
    }

    if (args?.take) {
      query = query.limit(args.take)
    }

    return query.execute()
  }

  async findUnique(args: { where: Record<string, any>; select?: string[] }): Promise<any | undefined> {
    let query = this.kysely.selectFrom(this.tableName).selectAll()
    query = this.applyWhereConditions(query, args.where)

    const results = await query.execute()
    return results.length > 0 ? results[0] : undefined
  }

  async findFirst(args?: {
    where?: Record<string, any>
    select?: string[]
    orderBy?: Record<string, 'asc' | 'desc'>
  }): Promise<any | null> {
    let query = this.kysely.selectFrom(this.tableName).selectAll()

    if (args?.where) {
      query = this.applyWhereConditions(query, args.where)
    }

    if (args?.orderBy) {
      for (const [field, direction] of Object.entries(args.orderBy)) {
        query = query.orderBy(field as any, direction)
      }
    }

    query = query.limit(1)
    const results = await query.execute()
    return results.length > 0 ? results[0] : null
  }

  async create(args: { data: Record<string, any> }): Promise<any> {
    const data = this.prepareCreateData(args.data)

    const result = await this.kysely
      .insertInto(this.tableName)
      .values(data as any)
      .returningAll()
      .executeTakeFirstOrThrow()

    return result
  }

  async createMany(args: { data: any[] }): Promise<{ count: number }> {
    const dataArray = args.data.map((item) => this.prepareCreateData(item))

    await this.kysely
      .insertInto(this.tableName)
      .values(dataArray as any)
      .execute()

    return { count: dataArray.length }
  }

  async update(args: { where: Record<string, any>; data: Record<string, any> }): Promise<any> {
    const data = this.prepareUpdateData(args.data)

    let query = this.kysely.updateTable(this.tableName).set(data as any)
    query = this.applyWhereConditions(query, args.where)

    const result = await query.returningAll().executeTakeFirstOrThrow()
    return result
  }

  async updateMany(args: { where?: Record<string, any>; data: Record<string, any> }): Promise<{ count: number }> {
    const data = this.prepareUpdateData(args.data)

    let query = this.kysely.updateTable(this.tableName).set(data as any)

    if (args.where) {
      query = this.applyWhereConditions(query, args.where)
    }

    const result = await query.execute()
    return {
      count: Array.isArray(result)
        ? result.length
        : Number((result as { numUpdatedRows?: number }).numUpdatedRows || 0),
    }
  }

  async upsert(args: {
    where: Record<string, any>
    create: Record<string, any>
    update: Record<string, any>
  }): Promise<any> {
    const createData = this.prepareCreateData(args.create)
    const updateData = this.prepareUpdateData(args.update)

    // Find unique field for conflict resolution
    const uniqueField = this.findUniqueField()
    const conflictColumn = uniqueField ? uniqueField.name : 'id' // Use field name as-is (Prisma default)

    const result = await this.kysely
      .insertInto(this.tableName)
      .values(createData as any)
      .onConflict((oc: OnConflictBuilder<any, any>) => oc.column(conflictColumn).doUpdateSet(updateData))
      .returningAll()
      .executeTakeFirstOrThrow()

    return result
  }

  async delete(args: { where: Record<string, any> }): Promise<any> {
    let query = this.kysely.deleteFrom(this.tableName)
    query = this.applyWhereConditions(query, args.where)

    const result = await query.returningAll().executeTakeFirstOrThrow()
    return result
  }

  async deleteMany(args?: { where?: Record<string, any> }): Promise<{ count: number }> {
    let query = this.kysely.deleteFrom(this.tableName)

    if (args?.where) {
      query = this.applyWhereConditions(query, args.where)
    }

    const result = await query.execute()
    return {
      count: Array.isArray(result)
        ? result.length
        : Number((result as { numDeletedRows?: number }).numDeletedRows || 0),
    }
  }

  async count(args?: { where?: Record<string, any> }): Promise<number> {
    let query = this.kysely
      .selectFrom(this.tableName)
      .select((eb: ExpressionBuilder<any, any>) => eb.fn.count('id').as('count'))

    if (args?.where) {
      query = this.applyWhereConditions(query, args.where)
    }

    const result = (await query.executeTakeFirst()) as { count: string | number | bigint } | undefined
    return Number(result?.count || 0)
  }
}

/**
 * Main Refract Client class
 */
export class RefractClient<TSchema extends DatabaseSchema = DatabaseSchema> {
  /** Direct Kysely access for advanced queries */
  readonly $kysely: Kysely<ClientTypeWithPrecedence<TSchema>>

  constructor(dialect: Dialect, options: RefractClientOptions = {}) {
    this.$kysely = new Kysely<ClientTypeWithPrecedence<TSchema>>({ dialect })
    this.initializeModels(options.schema)
  }

  /** Connection management */
  async $connect(): Promise<void> {
    // Kysely handles connections automatically, but we provide this for compatibility
    // Most dialects don't need explicit connection management
  }

  async $disconnect(): Promise<void> {
    // Properly destroy the Kysely instance and its connections
    await this.$kysely.destroy()
  }

  async $transaction<T>(fn: (client: RefractClient<TSchema>) => Promise<T>): Promise<T> {
    return this.$kysely.transaction().execute(async (trx) => {
      // Create transaction client by copying current instance and replacing kysely
      const trxClient = Object.create(this)
      Object.defineProperty(trxClient, '$kysely', {
        value: trx,
        writable: false,
        enumerable: false,
        configurable: false,
      })
      return fn(trxClient)
    })
  }

  /**
   * Initialize model operations on the client instance
   */
  private initializeModels(schema?: string): void {
    if (!schema) {
      return
    }

    try {
      const parseResult = parseSchema(schema)

      if (parseResult.errors.length === 0 && parseResult.ast.models.length > 0) {
        parseResult.ast.models.forEach((model) => {
          const clientPropertyName = this.toCamelCase(model.name)
          const tableName = this.getTableName(model)
          const modelOps = new ModelOperations(this.$kysely as any, tableName, model)

          // Assign model operations to client instance
          ;(this as any)[clientPropertyName] = modelOps
        })
      } else if (parseResult.errors.length > 0) {
        console.error('Schema parsing errors:', parseResult.errors)
      }
    } catch (error) {
      console.error('Failed to parse schema:', error)
    }
  }

  /**
   * Convert PascalCase to camelCase
   */
  private toCamelCase(str: string): string {
    return str.charAt(0).toLowerCase() + str.slice(1)
  }

  /**
   * Get table name for a model, respecting @@map directive
   * This follows Prisma's convention:
   * - If @@map("table_name") is specified, use that
   * - Otherwise, use the model name as-is (Prisma's default)
   */
  private getTableName(model: ModelAST): string {
    // Check for @@map attribute
    const mapAttribute = model.attributes.find((attr) => attr.name === 'map')
    if (mapAttribute && mapAttribute.args[0]) {
      return String(mapAttribute.args[0].value)
    }

    // Default: use model name as-is (Prisma's default behavior)
    // This means User model → "User" table (not "users")
    return model.name
  }

  /** Dynamic model properties - added at runtime based on schema */
  [modelName: string]: ModelCRUDOperations | any
}

/**
 * Type utility to detect if a generic was explicitly provided
 * This helps us implement the "explicit over implicit" precedence
 */
type IsAny<T> = 0 extends 1 & T ? true : false
type IsExplicitGeneric<T> = IsAny<T> extends true ? false : true

/**
 * Type precedence logic for two clean paths
 * 1. Manual Fallback: Explicit generic types (user imports types manually)
 * 2. Recommended: Generated types via module augmentation (unplugin-refract)
 */
type ClientTypeWithPrecedence<T> = IsExplicitGeneric<T> extends true
  ? T // Manual Fallback: User provided explicit types
  : RefractGeneratedSchema // Recommended: unplugin-refract generated types

// Types are exported inline above
