import { GeneratorConfig } from '@prisma/generator-helper'

export type QueryEngineProtocol = 'graphql' | 'json'

// TODO: remove
export function getQueryEngineProtocol(generatorConfig?: GeneratorConfig): QueryEngineProtocol {
  void generatorConfig
  return 'json'
}
