import type { GeneratorConfig } from '@prisma/generator-helper'

export enum ClientEngineType {
  Library = 'library',
  Binary = 'binary',
  Client = 'client',
}

export const DEFAULT_CLIENT_ENGINE_TYPE = ClientEngineType.Library

export function getClientEngineType(generatorConfig?: GeneratorConfig): ClientEngineType {
  const engineTypeFromEnvVar = getEngineTypeFromEnvVar()
  if (engineTypeFromEnvVar) return engineTypeFromEnvVar
  if (generatorConfig?.config.engineType === ClientEngineType.Library) {
    return ClientEngineType.Library
  }if (generatorConfig?.config.engineType === ClientEngineType.Binary) {
    return ClientEngineType.Binary
  }if (generatorConfig?.config.engineType === ClientEngineType.Client) {
    return ClientEngineType.Client
  }
    return DEFAULT_CLIENT_ENGINE_TYPE
}

function getEngineTypeFromEnvVar() {
  const engineType = process.env.PRISMA_CLIENT_ENGINE_TYPE
  if (engineType === ClientEngineType.Library) {
    return ClientEngineType.Library
  }if (engineType === ClientEngineType.Binary) {
    return ClientEngineType.Binary
  }if (engineType === ClientEngineType.Client) {
    return ClientEngineType.Client
  }
    return undefined
}
