import type { Datasources, PrismaClientOptions } from '../../getPrismaClient'

export function getDatasourceOverrides(
  options: PrismaClientOptions | undefined,
  datasourceNames: string[],
): Datasources {
  if (!options) {
    return {}
  }

  if (options.datasources) {
    return options.datasources
  }

  if (options.datasourceUrl) {
    const primaryDatasource = datasourceNames[0]
    return { [primaryDatasource]: { url: options.datasourceUrl } }
  }
  return {}
}
