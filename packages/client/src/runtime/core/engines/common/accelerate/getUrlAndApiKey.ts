import { PRISMA_POSTGRES_PROTOCOL } from '@prisma/internals'

import { resolveDatasourceUrl } from '../../../init/resolveDatasourceUrl'
import { InvalidDatasourceError } from '../../data-proxy/errors/InvalidDatasourceError'
import { EngineConfig } from '../Engine'

export interface GetUrlAndApiKeyOptions {
  clientVersion: string
  inlineDatasources: EngineConfig['inlineDatasources']
  overrideDatasources: EngineConfig['overrideDatasources']
  env: Record<string, string | undefined>
}

export interface UrlAndApiKey {
  apiKey: string
  url: URL
}

export function getUrlAndApiKey(options: GetUrlAndApiKeyOptions): UrlAndApiKey {
  const errorInfo = { clientVersion: options.clientVersion }
  const dsName = Object.keys(options.inlineDatasources)[0]
  const serviceURL = resolveDatasourceUrl({
    inlineDatasources: options.inlineDatasources,
    overrideDatasources: options.overrideDatasources,
    clientVersion: options.clientVersion,
    env: { ...options.env, ...(typeof process !== 'undefined' ? process.env : {}) },
  })

  let url: URL
  try {
    url = new URL(serviceURL)
  } catch {
    throw new InvalidDatasourceError(
      `Error validating datasource \`${dsName}\`: the URL must start with the protocol \`prisma://\``,
      errorInfo,
    )
  }

  const { protocol, searchParams } = url

  if (protocol !== 'prisma:' && protocol !== PRISMA_POSTGRES_PROTOCOL) {
    throw new InvalidDatasourceError(
      `Error validating datasource \`${dsName}\`: the URL must start with the protocol \`prisma://\` or \`prisma+postgres://\``,
      errorInfo,
    )
  }

  const apiKey = searchParams.get('api_key')
  if (apiKey === null || apiKey.length < 1) {
    throw new InvalidDatasourceError(
      `Error validating datasource \`${dsName}\`: the URL must contain a valid API key`,
      errorInfo,
    )
  }

  return { apiKey, url }
}
