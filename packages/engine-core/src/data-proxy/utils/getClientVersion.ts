import Debug from '@prisma/debug'

import type { EngineConfig } from '../../common/Engine'
import { NotImplementedYetError } from '../errors/NotImplementedYetError'

const debug = Debug('prisma:engine-core:getClientVersion')

/**
 * Determine the client version to be sent to the DataProxy
 * @param config
 * @returns
 */
export function getClientVersion(config: EngineConfig): string {
  const dataproxyClientVersionFromEnvVar = process.env.PRISMA_CLIENT_DATA_PROXY_CLIENT_VERSION

  if (dataproxyClientVersionFromEnvVar) {
    debug(`Client version: "${dataproxyClientVersionFromEnvVar}" from PRISMA_CLIENT_DATA_PROXY_CLIENT_VERSION env var.`)
    return dataproxyClientVersionFromEnvVar
  } else if (config.clientVersion) {
    const [version, suffix] = config.clientVersion.split('-')
    debug(`Client version: "${version}" from config.clientVersion.`)

    // we expect the version to match the pattern major.minor.patch
    if (!suffix && /^[1-9][0-9]*\.[0-9]+\.[0-9]+$/.test(version)) {
      return version
    } else {
      throw new NotImplementedYetError('Only `major.minor.patch` versions are supported by Prisma Data Proxy.', {
        clientVersion: config.clientVersion,
      })
    }
  } else {
    throw new NotImplementedYetError(
      'clientVersion or `PRISMA_CLIENT_DATA_PROXY_CLIENT_VERSION` env var needs to be set with a `major.minor.patch` version for Prisma Data Proxy.',
      {
        clientVersion: '',
      },
    )
  }

  // TODO: we should have a Data Proxy deployment which accepts any
  // arbitrary version for testing purposes.
}
