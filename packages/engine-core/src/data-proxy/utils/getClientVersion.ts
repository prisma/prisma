import Debug from '@prisma/debug'
import { version as engineVersion } from '@prisma/engines/package.json'

import type { EngineConfig } from '../../common/Engine'
import { NotImplementedYetError } from '../errors/NotImplementedYetError'
import { request } from './request'

const semverRegex = /^[1-9][0-9]*\.[0-9]+\.[0-9]+$/
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

  // if it is an integration or dev version, we resolve its dataproxy
  // for this we infer the data proxy version from the engine version
  if (suffix !== undefined || clientVersion === '0.0.0') {
    const [version] = engineVersion.split('-') ?? []
    const [major, minor, patch] = version.split('.')

    // to ensure that the data proxy exists, we check if it's published
    // we resolve with the closest or previous version published on npm
    const pkgURL = prismaPkgURL(`<=${major}.${minor}.${patch}`)
    const res = await request(pkgURL, { clientVersion })

    return (await res.json())['version'] as string
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

/**
 * We use unpkg.com to resolve the version of the data proxy. We chose this over
 * registry.npmjs.com because they cache their queries/responses so it is fast.
 * Moreover, unpkg.com is able to support comparison operators like `<=1.0.0`.
 * For us, that means we can provide a version that is too high (not published),
 * and it will be able to resolve to the closest existing (published) version.
 * @param version
 * @returns
 */
function prismaPkgURL(version: string) {
  return encodeURI(`https://unpkg.com/prisma@${version}/package.json`)
}
