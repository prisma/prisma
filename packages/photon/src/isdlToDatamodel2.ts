import { Dictionary } from '@prisma/cli'
import { ISDL } from 'prisma-datamodel'
import { dmmfToDml } from './engineCommands'
import { isdlToDmmfDatamodel } from './isdlToDmmf'

export type ConnectorType = 'mysql' | 'mongo' | 'sqlite' | 'postgresql'

export interface ConfigMetaFormat {
  datasources: DataSource[]
  generators: GeneratorConfig[]
}

export interface GeneratorConfig {
  name: string
  output: string | null
  provider: string
  config: Dictionary<string>
}

export interface DataSource {
  name: string
  connectorType: ConnectorType
  url: string
  config: {}
}

export async function isdlToDatamodel2(isdl: ISDL, datasources: DataSource[], generators: GeneratorConfig[] = []) {
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
