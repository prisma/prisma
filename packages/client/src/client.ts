import { type Dialect, Kysely, type LogConfig } from 'kysely'

import type { DatabaseSchema } from './types.js'

/**
 * Function that can build model operations for a given Kysely instance.
 * Generated clients provide this so transactions can rehydrate operations with scoped connections.
 */
export type ModelFactory<TSchema extends DatabaseSchema> = (kysely: Kysely<TSchema>) => Record<string, unknown>

export interface OrkClientOptions<TSchema extends DatabaseSchema> {
  /**
   * Optional factory that was used to create model operations.
   * Providing this enables transaction support that reuses the same CRUD surface inside the transaction scope.
   */
  modelFactory?: ModelFactory<TSchema>
  /**
   * Optional Kysely log configuration.
   * Passes through to the underlying Kysely instance.
   */
  log?: LogConfig
}

/**
 * Minimal runtime client that manages the Kysely instance and exposes hooks for generated CRUD operations.
 * Generated client modules extend this class and register their model operations via `registerModel`.
 */
export class OrkClientBase<TSchema extends DatabaseSchema = DatabaseSchema> {
  /** Direct access to the underlying Kysely instance for advanced queries. */
  readonly $kysely: Kysely<TSchema>

  private readonly modelFactory?: ModelFactory<TSchema>
  private readonly modelNames = new Set<string>()

  constructor(dialect: Dialect, options: OrkClientOptions<TSchema> = {}) {
    this.$kysely = new Kysely<TSchema>({ dialect, log: options.log })
    this.modelFactory = options.modelFactory

    if (this.modelFactory) {
      const initialModels = this.modelFactory(this.$kysely)
      this.attachModels(initialModels)
    }
  }

  /** Hook for subclasses or generated clients to register CRUD operations on the runtime instance. */
  protected registerModel(name: string, operations: unknown): void {
    this.defineModelProperty(this as Record<string, unknown>, name, operations)
  }

  /** Allow subclasses to attach multiple models at once. */
  protected attachModels(models: Record<string, unknown>): void {
    this.attachModelsToTarget(this as Record<string, unknown>, models)
  }

  /** Connection lifecycle mirrors Prisma's surface for compatibility. */
  async $connect(): Promise<void> {
    // Kysely lazily opens connections; nothing to do here for most dialects.
  }

  async $disconnect(): Promise<void> {
    await this.$kysely.destroy()
  }

  async $transaction<T>(fn: (client: this) => Promise<T>): Promise<T> {
    return this.$kysely.transaction().execute(async (trx) => {
      const transactionalClient = this.createTransactionalScope(trx)
      return await fn(transactionalClient)
    })
  }

  /**
   * Create a transaction-scoped clone of the current client.
   * Generated clients rely on the stored modelFactory to hydrate model operations with the transaction Kysely.
   */
  protected createTransactionalScope(kysely: Kysely<TSchema>): this {
    const scope = Object.create(Object.getPrototypeOf(this)) as this

    // Copy private fields
    Object.defineProperty(scope, '$kysely', {
      value: kysely,
      enumerable: false,
      configurable: false,
      writable: false,
    })

    Object.defineProperty(scope, 'modelFactory', {
      value: this.modelFactory,
      enumerable: false,
      configurable: false,
      writable: false,
    })

    Object.defineProperty(scope, 'modelNames', {
      value: new Set(this.modelNames),
      enumerable: false,
      configurable: false,
      writable: false,
    })

    if (this.modelFactory) {
      const scopedModels = this.modelFactory(kysely)
      this.attachModelsToTarget(scope as Record<string, unknown>, scopedModels)
    } else {
      // Fall back to sharing the existing operations if no factory is provided.
      for (const name of this.modelNames) {
        this.defineModelProperty(scope as Record<string, unknown>, name, (this as Record<string, unknown>)[name])
      }
    }

    return scope
  }

  private attachModelsToTarget(target: Record<string, unknown>, models: Record<string, unknown>): void {
    for (const [name, operations] of Object.entries(models)) {
      this.defineModelProperty(target, name, operations)
    }
  }

  private defineModelProperty(target: Record<string, unknown>, name: string, operations: unknown): void {
    Object.defineProperty(target, name, {
      value: operations,
      enumerable: true,
      configurable: false,
      writable: false,
    })

    this.modelNames.add(name)
  }
}
