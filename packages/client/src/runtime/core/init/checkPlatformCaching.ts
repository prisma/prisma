import Debug from '@prisma/debug'
import { PrismaClientInitializationError } from '@prisma/engine-core'

import type { GetPrismaClientConfig } from '../../getPrismaClient'

const debug = Debug('prisma:client')

/**
 * Known platforms that have caching issues. Updating this list will also update
 * the error message and the link to the docs, so add docs/links as needed. The
 * key from this map comes from the `ciName` property of the `ci-info` package.
 */
const cachingPlatforms = {
  Vercel: 'vercel',
  'Netlify CI': 'netlify',
} as const

type Config = Pick<GetPrismaClientConfig, 'postinstall' | 'ciName' | 'clientVersion'>

/**
 * Throws an error if the client has been generated via auto-install and the
 * platform is known to have caching issues. In that case, we will display a
 * useful error message, and ask the user to run `prisma generate` manually.
 * @returns
 */
export function checkPlatformCaching({ postinstall, ciName, clientVersion }: Config) {
  debug('checkPlatformCaching:postinstall', postinstall)
  debug('checkPlatformCaching:ciName', ciName)

  // if client was not generated manually
  if (postinstall !== true) return

  // and we generated on one a caching CI
  if (ciName && ciName in cachingPlatforms) {
    throw new PrismaClientInitializationError(
      `We have detected that you've built your project on ${ciName}, which caches dependencies.
This leads to an outdated Prisma Client because Prisma's auto-generation isn't triggered.
To fix this, make sure to run the \`prisma generate\` command during your build process.
Learn how: https://pris.ly/d/${cachingPlatforms[ciName]}-build`,
      clientVersion,
    )
  }
}
