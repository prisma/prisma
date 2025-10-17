import type { GeneratorConfig } from '@prisma/generator'

export enum ClientEngineType {
  Client = 'client',
}

let hasWarnedAboutDeprecatedEngineType = false

function warnDeprecatedEngineType(engineType: string) {
  if (!hasWarnedAboutDeprecatedEngineType) {
    console.warn(`Warning: engineType "${engineType}" is deprecated and will be removed. Using "client" instead.`)
    hasWarnedAboutDeprecatedEngineType = true
  }
}

export function getClientEngineType(generatorConfig?: GeneratorConfig): ClientEngineType {
  const engineTypeFromEnvVar = getEngineTypeFromEnvVar()
  if (engineTypeFromEnvVar) return engineTypeFromEnvVar

  const configuredEngineType = generatorConfig?.config.engineType
  if (configuredEngineType === 'library' || configuredEngineType === 'binary') {
    warnDeprecatedEngineType(configuredEngineType)
    return ClientEngineType.Client
  }

  if (configuredEngineType === ClientEngineType.Client) {
    return ClientEngineType.Client
  }

  return getDefaultEngineType()
}

function getEngineTypeFromEnvVar() {
  const engineType = process.env.PRISMA_CLIENT_ENGINE_TYPE
  if (engineType === ClientEngineType.Client) {
    return ClientEngineType.Client
  } else if (engineType === 'library' || engineType === 'binary') {
    warnDeprecatedEngineType(engineType)
    return ClientEngineType.Client
  } else {
    return undefined
  }
}

function getDefaultEngineType(): ClientEngineType {
  return ClientEngineType.Client
}
