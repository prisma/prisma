import Debug from '@prisma/debug'
import { version as engineVersion } from '@prisma/engines/package.json'

import type { EngineConfig } from '../../common/Engine'
import { NotImplementedYetError } from '../errors/NotImplementedYetError'
import { request } from './request'

const semverRegex = /^[1-9][0-9]*\.[0-9]+\.[0-9]+$/
const prismaNpm = 'https://registry.npmjs.org/prisma'
const debug = Debug('prisma:client:dataproxyEngine')

async function _getClientVersion(config: EngineConfig) {
  const clientVersion = config.clientVersion ?? 'unknown'

  // internal override for testing and manual version overrides
  if (process.env.PRISMA_CLIENT_DATA_PROXY_CLIENT_VERSION) {
    return process.env.PRISMA_CLIENT_DATA_PROXY_CLIENT_VERSION
  }

  const [version, suffix] = clientVersion?.split('-') ?? []

  // we expect the version to match the pattern major.minor.patch
  if (suffix === undefined && semverRegex.test(version)) {
    return version
  }

  // if it's an integration version, we resolve its data proxy
  if (suffix === 'integration' || suffix === 'dev' || clientVersion === '0.0.0') {
    // we infer the data proxy version from the engine version
    const [version] = engineVersion.split('-') ?? []
    const [major, minor, patch] = version.split('.')

    // if a patch has happened, then we return that version
    if (patch !== '0') return `${major}.${minor}.${patch}`

    // if not, we know that the minor must be minus with 1
    const published = `${major}.${parseInt(minor) - 1}.x`

    // we don't know what `x` is, so we query the registry
    const res = await request(`${prismaNpm}/${published}`, { clientVersion })

    return ((await res.json())['version'] as string) ?? 'undefined'
  }

  // nothing matched, meaning that the provided version is invalid
  throw new NotImplementedYetError('Only `major.minor.patch` versions are supported by Prisma Data Proxy.', {
    clientVersion,
  })
}

/**
 * Determine the client version to be sent to the DataProxy
 * @param config
 * @returns
 */
export async function getClientVersion(config: EngineConfig) {
  const version = await _getClientVersion(config)

  debug('version', version)

  return version
}
