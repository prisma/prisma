import { getConfig, getRawDMMF, dmmfToDml, DataSource } from '@prisma/photon'

export async function replaceDatasource(schema: string, datasource: DataSource): Promise<string> {
  const [dmmf, config] = await Promise.all([getRawDMMF(schema), getConfig(schema)])

  config.datasources = [datasource]

  return dmmfToDml({
    config,
    dmmf: dmmf.datamodel,
  })
}
