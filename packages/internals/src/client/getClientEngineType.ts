import type { GeneratorConfig } from '@prisma/generator'

export enum ClientEngineType {
  Library = 'library',
  Binary = 'binary',
  Client = 'client',
}

export function getClientEngineType(generatorConfig?: GeneratorConfig): ClientEngineType {
  const engineTypeFromEnvVar = getEngineTypeFromEnvVar()
  if (engineTypeFromEnvVar) return engineTypeFromEnvVar
  if (generatorConfig?.config.engineType === ClientEngineType.Library) {
    return ClientEngineType.Library
  } else if (generatorConfig?.config.engineType === ClientEngineType.Binary) {
    return ClientEngineType.Binary
  } else if (generatorConfig?.config.engineType === ClientEngineType.Client) {
    return ClientEngineType.Client
  } else {
    return getDefaultEngineType(generatorConfig)
  }
}

function getEngineTypeFromEnvVar() {
  const engineType = process.env.PRISMA_CLIENT_ENGINE_TYPE
  if (engineType === ClientEngineType.Library) {
    return ClientEngineType.Library
  } else if (engineType === ClientEngineType.Binary) {
    return ClientEngineType.Binary
  } else if (engineType === ClientEngineType.Client) {
    return ClientEngineType.Client
  } else {
    return undefined
  }
}

function getDefaultEngineType(generatorConfig?: GeneratorConfig): ClientEngineType {
  if (generatorConfig?.previewFeatures.includes('queryCompiler')) {
    return ClientEngineType.Client
  }
  return ClientEngineType.Library
}
