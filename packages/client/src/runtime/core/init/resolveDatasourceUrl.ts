import { InlineDatasources } from '../../../generation/utils/buildInlineDatasources'
import { Datasources } from '../../getPrismaClient'
import { PrismaClientInitializationError } from '../errors/PrismaClientInitializationError'

export function resolveDatasourceUrl({
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

  // override is set in constructor but url is undefined
  if (overrideDatasources[datasourceName] !== undefined && resolvedUrl === undefined) {
    throw new PrismaClientInitializationError(
      `Datasource "${datasourceName}" was overridden in the constructor but the URL is "undefined".`,
      clientVersion,
    )
  }

  // env var is set for use but url is undefined
  if (datasourceUrl.fromEnvVar !== undefined && resolvedUrl === undefined) {
    throw new PrismaClientInitializationError(
      `Datasource "${datasourceName}" references an environment variable "${datasourceUrl.fromEnvVar}" that is not set`,
      clientVersion,
    )
  }

  // should not happen: no override, no env, no direct value
  if (resolvedUrl === undefined) {
    throw new PrismaClientInitializationError(
      `Datasource "${datasourceName}" has no defined URL environment variable, value, or override.`,
      clientVersion,
    )
  }

  return resolvedUrl
}
