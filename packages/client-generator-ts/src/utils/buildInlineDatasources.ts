import type { GetPrismaClientConfig } from '@prisma/client-common'
import { DataSource, EnvValue } from '@prisma/generator'

export function buildInlineDatasources(datasources: DataSource[]): GetPrismaClientConfig['inlineDatasources'] {
  return datasources.reduce((acc, ds) => {
    return ((acc[ds.name] = buildInlineDatasource(ds)), acc)
  }, {})
}

function buildInlineDatasource(ds: DataSource): { url: EnvValue } {
  if (ds.url.fromEnvVar) {
    // Ensure that we do NOT pass a value from an env var forward into the generated client!
    // See https://github.com/prisma/prisma/issues/27074.
    return { url: { fromEnvVar: ds.url.fromEnvVar, value: null } }
  } else {
    return { url: { fromEnvVar: null, value: ds.url.value } }
  }
}
