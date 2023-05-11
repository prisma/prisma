import { getQueryEngineProtocol } from '@prisma/internals'

import { TSClientOptions } from '../TSClient/TSClient'

export function buildEdgeClientProtocol({ edge, generator }: TSClientOptions) {
  if (edge === false) {
    return ''
  }

  const protocol = getQueryEngineProtocol(generator)

  return `config.edgeClientProtocol = "${protocol}";`
}
