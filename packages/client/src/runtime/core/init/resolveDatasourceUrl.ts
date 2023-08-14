import { Datasources, GetPrismaClientConfig } from '../../getPrismaClient'
import { PrismaClientInitializationError } from '../errors/PrismaClientInitializationError'

export function resolveDatasourceUrl({
  inlineDatasources,
  overrideDatasources,
  env,
  clientVersion,
}: {
  inlineDatasources: GetPrismaClientConfig['inlineDatasources']
  overrideDatasources: Datasources
  env: Record<string, string | undefined>
  clientVersion: string
}) {
  let resolvedUrl: string | undefined
  const datasourceName = Object.keys(inlineDatasources)[0]
  const datasourceUrl = inlineDatasources[datasourceName]?.url
  const overrideUrl = overrideDatasources[datasourceName]?.url

  if (datasourceName === undefined) {
    resolvedUrl = undefined
  } else if (overrideUrl) {
    resolvedUrl = overrideUrl
  } else if (datasourceUrl?.value) {
    resolvedUrl = datasourceUrl.value
  } else if (datasourceUrl?.fromEnvVar) {
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
  if (datasourceUrl?.fromEnvVar !== undefined && resolvedUrl === undefined) {
    // error matches as much as possible the usual engine error
    throw new PrismaClientInitializationError(
      `error: Environment variable not found: ${datasourceUrl.fromEnvVar}.`,
      clientVersion,
    )
  }

  // should not happen: no override, no env, no direct value
  if (resolvedUrl === undefined) {
    throw new PrismaClientInitializationError(
      `error: Missing URL environment variable, value, or override.`,
      clientVersion,
    )
  }

  return resolvedUrl
}
