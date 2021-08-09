import { GeneratorConfig } from '@prisma/generator-helper'

export enum ClientEngineType {
  Library = 'library',
  Binary = 'binary',
}
export const DEFAULT_CLIENT_ENGINE_TYPE = ClientEngineType.Binary

export function getClientEngineType(
  generator?: GeneratorConfig,
): ClientEngineType {
  const engineTypeFromEnvVar = getEngineTypeFromEnvVar()
  if (engineTypeFromEnvVar) return engineTypeFromEnvVar
  if (
    generator?.config.engineType === ClientEngineType.Library ||
    generator?.previewFeatures.includes('nApi')
  ) {
    return ClientEngineType.Library
  } else if (generator?.config.engineType === ClientEngineType.Binary) {
    return ClientEngineType.Binary
  }
  return DEFAULT_CLIENT_ENGINE_TYPE
}

function getEngineTypeFromEnvVar() {
  const engineType = process.env.PRISMA_CLIENT_ENGINE_TYPE
  if (engineType) {
    if (engineType === ClientEngineType.Library) {
      return ClientEngineType.Library
    } else if (engineType === ClientEngineType.Binary) {
      return ClientEngineType.Binary
    }
  }
  return undefined
}
