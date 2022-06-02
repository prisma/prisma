import type { EngineConfig } from '../../common/Engine'
import { NotImplementedYetError } from '../errors/NotImplementedYetError'

const semverRegex = /^[1-9][0-9]*\.[0-9]+\.[0-9]+$/

/**
 * Determine the client version to be sent to the DataProxy
 * @param config
 * @returns
 */
export function getClientVersion(config: EngineConfig) {
  // internal override for testing and manual version overrides
  if (process.env.PRISMA_CLIENT_DATA_PROXY_CLIENT_VERSION) {
    return process.env.PRISMA_CLIENT_DATA_PROXY_CLIENT_VERSION
  }

  const [version, suffix] = config.clientVersion?.split('-') ?? []

  // we expect the version to match the pattern major.minor.patch
  if (suffix === undefined && semverRegex.test(version)) {
    return version
  }

  // then it must be an integration version, so we use its parent
  if (suffix === 'integration' && semverRegex.test(version)) {
    const [major, minor] = version.split('.')
    return `${major}.${parseInt(minor) - 1}.${0}`
  }

  // nothing matched, meaning that the provided version is invalid
  throw new NotImplementedYetError('Only `major.minor.patch` versions are supported by Prisma Data Proxy.', {
    clientVersion: config.clientVersion ?? 'undefined',
  })
}
