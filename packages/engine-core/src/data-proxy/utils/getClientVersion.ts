import type { EngineConfig } from '../../common/Engine'
import { NotImplementedYetError } from '../errors/NotImplementedYetError'

/**
 * Determine the client version to be sent to the DataProxy
 * @param config
 * @returns
 */
export function getClientVersion(config: EngineConfig): string {
  if (process.env.PRISMA_CLIENT_DATA_PROXY_CLIENT_VERSION) {
    // should we log with debug here that this env var is used?
    return process.env.PRISMA_CLIENT_DATA_PROXY_CLIENT_VERSION
  } else if (config.clientVersion) {
    const [version, suffix] = config.clientVersion.split('-') ?? []
    // we expect the version to match the pattern major.minor.patch
    if (!suffix && /^[1-9][0-9]*\.[0-9]+\.[0-9]+$/.test(version)) {
      return version
    } else {
      throw new NotImplementedYetError('Only `major.minor.patch` versions are supported.', {
        clientVersion: config.clientVersion,
      })
    }
  } else {
    throw new NotImplementedYetError(
      'clientVersion or `PRISMA_CLIENT_DATA_PROXY_CLIENT_VERSION` env var needs to be set with a `major.minor.patch` version.',
      {
        clientVersion: '',
      },
    )
  }

  // TODO: we should have a Data Proxy deployment which accepts any
  // arbitrary version for testing purposes.
}
