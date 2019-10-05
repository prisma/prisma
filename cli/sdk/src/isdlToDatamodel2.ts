import { ISDL } from 'prisma-datamodel'
import { dmmfToDml } from './engineCommands'
import { isdlToDmmfDatamodel } from './isdlToDmmf'
import { DataSource, GeneratorConfig } from '@prisma/generator-helper'

export type ConnectorType = 'mysql' | 'mongo' | 'sqlite' | 'postgresql'

export interface ConfigMetaFormat {
  datasources: DataSource[]
  generators: GeneratorConfig[]
}

export type Dictionary<T> = {
  [key: string]: T
}

export interface EnvValue {
  fromEnvVar: null | string
  value: string
}

export async function isdlToDatamodel2(
  isdl: ISDL,
  datasources: DataSource[],
  generators: GeneratorConfig[] = [],
) {
  const { dmmf } = await isdlToDmmfDatamodel(isdl)

  const result = await dmmfToDml({
    dmmf,
    config: { datasources, generators: generators.map(ensureNewFields) },
  })

  return result
}

function ensureNewFields(generator) {
  return {
    platforms: [],
    pinnedPlatform: null,
    ...generator,
  }
}
