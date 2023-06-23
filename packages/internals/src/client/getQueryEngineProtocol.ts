import { GeneratorConfig } from '@prisma/generator-helper'

export type QueryEngineProtocol = 'graphql' | 'json'

export function getQueryEngineProtocol(generatorConfig?: GeneratorConfig): QueryEngineProtocol {
  const fromEnv = process.env.PRISMA_ENGINE_PROTOCOL
  if (fromEnv === 'json' || fromEnv == 'graphql') {
    return fromEnv
  }

  if (fromEnv !== undefined) {
    throw new Error(`Invalid PRISMA_ENGINE_PROTOCOL env variable value. Expected 'graphql' or 'json', got '${fromEnv}'`)
  }

  if (generatorConfig?.previewFeatures?.includes('jsonProtocol')) {
    return 'json'
  }
  return 'graphql'
}
