import type { EngineConfig } from '../../common/Engine'
import { NotImplementedYetError } from '../errors/NotImplementedYetError'

/**
 * Determine the client version to be sent to the DataProxy
 * @param config
 * @returns
 */
export function getClientVersion(config: EngineConfig) {
  const [version, suffix] = config.clientVersion?.split('-') ?? []

  // we expect the version to match the pattern major.minor.patch
  if (!suffix && /^[1-9][0-9]*\.[0-9]+\.[0-9]+$/.test(version)) {
    return version
  }

  // TODO: we should have a Data Proxy deployment which accepts any
  // arbitrary version for testing purposes.

  // TODO: Add way to provide fallback manually, e.g. via env var

  throw new NotImplementedYetError('Support for non major.minor.patch versions is not implemented yet.', {
    clientVersion: config.clientVersion,
  })

  return 'foo'
}
