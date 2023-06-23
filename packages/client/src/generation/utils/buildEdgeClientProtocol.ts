import { GeneratorConfig } from '@prisma/generator-helper'
import { getQueryEngineProtocol } from '@prisma/internals'

export function buildEdgeClientProtocol(edge: boolean, config: GeneratorConfig | undefined) {
  if (!edge) {
    return ''
  }
  const protocol = getQueryEngineProtocol(config)

  return `config.edgeClientProtocol = "${protocol}";`
}
