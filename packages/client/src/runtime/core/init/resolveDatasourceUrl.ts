import type { Datasources, GetPrismaClientConfig } from '../../getPrismaClient'
import { getRuntime } from '../../utils/getRuntime'
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

  // env var is set for use but url is undefined
  if (datasourceUrl?.fromEnvVar !== undefined && resolvedUrl === undefined) {
    if ((TARGET_BUILD_TYPE === 'edge' || TARGET_BUILD_TYPE === 'wasm') && getRuntime().id === 'workerd') {
      throw new PrismaClientInitializationError(
        `error: Environment variable not found: ${datasourceUrl.fromEnvVar}.

In Cloudflare module Workers, environment variables are available only in the Worker's \`env\` parameter of \`fetch\`.
To solve this, provide the connection string directly: https://pris.ly/d/cloudflare-datasource-url`,
        clientVersion,
      )
    }

    // error matches as much as possible the usual engine error
    throw new PrismaClientInitializationError(
      `error: Environment variable not found: ${datasourceUrl.fromEnvVar}.`,
      clientVersion,
    )
  }

  // should not happen: no override, no env, no direct value
  if (resolvedUrl === undefined) {
    throw new PrismaClientInitializationError(
      'error: Missing URL environment variable, value, or override.',
      clientVersion,
    )
  }

  return resolvedUrl
}
