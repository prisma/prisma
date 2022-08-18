import type { DataSource, GeneratorConfig } from '@prisma/generator-helper'

/**
 * Note: these types are copied from packages/engine-core/src/common/types/QueryEngine.ts
 * to avoid circular type dependencies.
 */

export type GetConfigOptions = {
  datamodel: string
  ignoreEnvVarErrors: boolean
  datasourceOverrides: Record<string, string>
  env: NodeJS.ProcessEnv | Record<string, string>
}

export type ConfigMetaFormat = {
  datasources: DataSource[]
  generators: GeneratorConfig[]
  warnings: string[]
}

export type Library = {
  version: () => {
    commit: string
    version: string
  }
  getConfig: (options: GetConfigOptions) => Promise<ConfigMetaFormat>
  /**
   * This returns a string representation of `DMMF.Document`
   */
  dmmf: (datamodel: string) => Promise<string>
  /**
   * Artificial panic function that can be used to test the query engine
   */
  debugPanic: (message?: string) => Promise<never>
}
