import type { GeneratorConfig } from '@prisma/generator-helper'

export enum ClientEngineType {
  Library = 'library',
  Binary = 'binary',
}

export const DEFAULT_CLIENT_ENGINE_TYPE = ClientEngineType.Library

export function getClientEngineType(generatorConfig?: GeneratorConfig): ClientEngineType {
  const engineTypeFromEnvVar = getEngineTypeFromEnvVar()
  if (engineTypeFromEnvVar) return engineTypeFromEnvVar
  if (generatorConfig?.config.engineType === ClientEngineType.Library) {
    return ClientEngineType.Library
  } else if (generatorConfig?.config.engineType === ClientEngineType.Binary) {
    return ClientEngineType.Binary
  } else {
    return DEFAULT_CLIENT_ENGINE_TYPE
  }
}

function getEngineTypeFromEnvVar() {
  const engineType = process.env.PRISMA_CLIENT_ENGINE_TYPE
  if (engineType === ClientEngineType.Library) {
    return ClientEngineType.Library
  } else if (engineType === ClientEngineType.Binary) {
    return ClientEngineType.Binary
  } else {
    return undefined
  }
}
