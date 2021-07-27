import { GeneratorConfig } from '@prisma/generator-helper'

export enum ClientEngineType {
  NodeAPI = 'node-api',
  Binary = 'binary',
  Proxy = 'proxy',
}
export const DEFAULT_CLIENT_ENGINE_TYPE = ClientEngineType.NodeAPI

export function getClientEngineType(
  generator?: GeneratorConfig,
): ClientEngineType {
  const engineTypeFromEnvVar = getEngineTypeFromEnvVar()
  if (engineTypeFromEnvVar) return engineTypeFromEnvVar
  if (generator?.config.engineType === ClientEngineType.NodeAPI) {
    return ClientEngineType.NodeAPI
  } else if (generator?.config.engineType === ClientEngineType.Binary) {
    return ClientEngineType.Binary
  }
  return DEFAULT_CLIENT_ENGINE_TYPE
}

function getEngineTypeFromEnvVar() {
  const engineType = process.env.PRISMA_CLIENT_ENGINE_TYPE
  if (engineType) {
    if (engineType === ClientEngineType.NodeAPI) {
      return ClientEngineType.NodeAPI
    } else if (engineType === ClientEngineType.Binary) {
      return ClientEngineType.Binary
    }
  }
  return undefined
}
