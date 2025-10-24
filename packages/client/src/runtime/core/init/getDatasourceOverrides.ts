import { Datasources, PrismaClientOptions } from '../../getPrismaClient'

export function getDatasourceOverrides(options: PrismaClientOptions | undefined): Datasources {
  if (!options) {
    return {}
  }

  if (options.datasources) {
    return options.datasources
  }

  return {}
}
