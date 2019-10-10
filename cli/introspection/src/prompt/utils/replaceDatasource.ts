import { getConfig, getDMMF, dmmfToDml } from '@prisma/sdk'
import { GeneratorConfig, DataSource } from '@prisma/generator-helper'

export async function replaceDatasource(datamodel: string, datasource: DataSource): Promise<string> {
  const [dmmf, config] = await Promise.all([getDMMF({ datamodel }), getConfig({ datamodel })])

  config.datasources = [datasource]

  return dmmfToDml({
    config,
    dmmf: dmmf.datamodel,
  })
}

export async function replaceGenerator(datamodel: string, generator: GeneratorConfig): Promise<string> {
  const [dmmf, config] = await Promise.all([getDMMF({ datamodel }), getConfig({ datamodel })])

  config.generators = [generator]

  return dmmfToDml({
    config,
    dmmf: dmmf.datamodel,
  })
}
