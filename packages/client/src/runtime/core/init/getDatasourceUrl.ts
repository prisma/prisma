import { InlineDatasources } from '../../../generation/utils/buildInlineDatasources'
import { Datasources } from '../../getPrismaClient'
import { PrismaClientValidationError } from '../errors/PrismaClientValidationError'

export function getDatasourceUrl({
  inlineDatasources,
  overrideDatasources,
  env,
  clientVersion,
}: {
  inlineDatasources: InlineDatasources
  overrideDatasources: Datasources
  env: Record<string, string | undefined>
  clientVersion: string
}) {
  let resolvedUrl: string | undefined
  const datasourceName = Object.keys(inlineDatasources)[0]
  const datasourceUrl = inlineDatasources[datasourceName].url
  const overrideUrl = overrideDatasources[datasourceName]?.url

  if (overrideUrl !== undefined) {
    resolvedUrl = overrideUrl
  }

  if (datasourceUrl.value !== null) {
    resolvedUrl = datasourceUrl.value
  }

  if (datasourceUrl.fromEnvVar !== null) {
    resolvedUrl = env[datasourceUrl.fromEnvVar]
  }

  const errorInfo = { clientVersion }

  // override is set in constructor but url is undefined
  if (resolvedUrl === undefined && overrideDatasources[datasourceName] !== undefined) {
    throw new PrismaClientValidationError(
      `Datasource "${datasourceName}" was overridden in the constructor but the URL is "undefined".`,
      errorInfo,
    )
  }

  // env var is set for use but url is undefined
  if (resolvedUrl === undefined && datasourceUrl.fromEnvVar !== undefined) {
    throw new PrismaClientValidationError(
      `Datasource "${datasourceName}" references an environment variable "${datasourceUrl.fromEnvVar}" that is not set`,
      errorInfo,
    )
  }

  // should not happen: no override, no env, no direct value
  if (resolvedUrl === undefined) {
    throw new PrismaClientValidationError('Internal error: Datasource URL is undefined', errorInfo)
  }

  return resolvedUrl
}
