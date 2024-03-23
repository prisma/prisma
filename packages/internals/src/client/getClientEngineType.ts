import type { GeneratorConfig } from '@prisma/generator-helper'

export enum ClientEngineType {
  Library = 'library',
  Binary = 'binary',
}

type ClientEngineTypeValue = keyof { [T in ClientEngineType as `${T}`]: T }

export const DEFAULT_CLIENT_ENGINE_TYPE = ClientEngineType.Library

export function getClientEngineType(generatorConfig?: GeneratorConfig): ClientEngineType {
  return (
    getClientEngineTypeFromValue(process.env.PRISMA_CLIENT_ENGINE_TYPE) ||
    getClientEngineTypeFromValue(generatorConfig?.config.engineType) ||
    DEFAULT_CLIENT_ENGINE_TYPE
  )
}

function getClientEngineTypeFromValue(value: ClientEngineTypeValue | string | undefined): ClientEngineType | undefined {
  if (value === undefined) return undefined
  return Object.values(ClientEngineType).find((v) => v.toString() === value)
}
