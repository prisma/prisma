import { getConfig, getRawDMMF, dmmfToDml, DataSource } from '@prisma/photon'
import { GeneratorConfig } from '@prisma/photon/dist/isdlToDatamodel2'

export async function replaceDatasource(schema: string, datasource: DataSource): Promise<string> {
  const [dmmf, config] = await Promise.all([getRawDMMF(schema), getConfig(schema)])

  config.datasources = [datasource]

  return dmmfToDml({
    config,
    dmmf: dmmf.datamodel,
  })
}

export async function replaceGenerator(schema: string, generator: GeneratorConfig): Promise<string> {
  const [dmmf, config] = await Promise.all([getRawDMMF(schema), getConfig(schema)])

  config.generators = [generator]

  return dmmfToDml({
    config,
    dmmf: dmmf.datamodel,
  })
}
