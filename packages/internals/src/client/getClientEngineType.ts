import type { GeneratorConfig } from '@prisma/generator'

export enum ClientEngineType {
  Library = 'library',
  Client = 'client',
}

export function getClientEngineType(generatorConfig?: GeneratorConfig): ClientEngineType {
  const engineTypeFromEnvVar = getEngineTypeFromEnvVar()
  if (engineTypeFromEnvVar) return engineTypeFromEnvVar
  if (generatorConfig?.config.engineType === ClientEngineType.Library) {
    return ClientEngineType.Library
  } else if (generatorConfig?.config.engineType === ClientEngineType.Client) {
    return ClientEngineType.Client
  } else {
    return getDefaultEngineType()
  }
}

function getEngineTypeFromEnvVar() {
  const engineType = process.env.PRISMA_CLIENT_ENGINE_TYPE
  if (engineType === ClientEngineType.Library) {
    return ClientEngineType.Library
  } else if (engineType === ClientEngineType.Client) {
    return ClientEngineType.Client
  } else {
    return undefined
  }
}

function getDefaultEngineType(): ClientEngineType {
  return ClientEngineType.Library
}
