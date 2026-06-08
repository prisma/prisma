import { ActiveConnectorType } from '@prisma/generator'
import type { SerializedParamGraph } from '@prisma/param-graph'

import { CompilerWasmLoadingConfig } from './QueryCompiler'
import { RuntimeDataModel } from './runtimeDataModel'

export type DescriptorBoundMatcher = (args: unknown) => Record<string, unknown> | undefined

export type DescriptorBoundMatcherContext = {
  model: string
  action: unknown
  clientMethod: string
  args: unknown
  protocolQuery: unknown
  descriptor: unknown
  precomputedQueryPlanCacheHit: {
    cacheKey: string
    placeholderValues: Record<string, unknown>
  }
}

export type DescriptorBoundMatcherRegistry = {
  getMatcher(context: DescriptorBoundMatcherContext): DescriptorBoundMatcher | undefined
}

/**
 * Config that is stored into the generated client. When the generated client is
 * loaded, this same config is passed to {@link getPrismaClient} which creates a
 * closure with that config around a non-instantiated [[PrismaClient]].
 */
export type GetPrismaClientConfig = {
  runtimeDataModel: RuntimeDataModel
  previewFeatures: string[]
  clientVersion: string
  engineVersion: string
  activeProvider: ActiveConnectorType

  /**
   * The contents of the schema encoded into a string
   */
  inlineSchema: string

  /**
   * Optional wasm loading configuration
   */
  compilerWasm?: CompilerWasmLoadingConfig

  /**
   * Parameterization schema for schema-aware query parameterization.
   * Enables precise parameterization based on DMMF metadata.
   */
  parameterizationSchema: SerializedParamGraph

  descriptorMatcherRegistry?: DescriptorBoundMatcherRegistry
}
