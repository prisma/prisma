import type { PrismaConfigInternal } from '@prisma/config'

import { QueryPlanExecutorExtension } from './qpe'

export * from './qpe'

export type Extensions = {
  queryPlanExecutor: QueryPlanExecutorExtension
}

/**
 * Additional context that is passed to the subcommand.
 */
export type RunnableContext = {
  /**
   * Version of the CLI that is running the subcommand. Can be used to check for breaking changes etc..
   */
  readonly cliVersion: string

  /**
   * Request an extension with the specified name from the CLI.
   */
  getExtension<E extends keyof Extensions>(name: E): Promise<Extensions[E] | undefined>
}

/**
 * Sub-CLIs that are installed on demand need to implement this interface
 */
export type Runnable = {
  run: (args: string[], config: PrismaConfigInternal, context: RunnableContext) => Promise<void>
}

export class RunnableContextWithExtensionRegistry implements RunnableContext {
  readonly cliVersion: string
  readonly #extensions: {
    [E in keyof Extensions]?: () => Promise<Extensions[E]>
  }

  constructor(cliVersion: string) {
    this.cliVersion = cliVersion
    this.#extensions = {}
  }

  async getExtension<E extends keyof Extensions>(name: E): Promise<Extensions[E] | undefined> {
    const factory = this.#extensions[name]
    if (factory === undefined) {
      return undefined
    }
    return await factory()
  }

  registerExtension<E extends keyof Extensions>(name: E, factory: () => Promise<Extensions[E]>): void {
    this.#extensions[name] = factory
  }
}
